import { ElectrumClient, TransactionDetails, TransactionState } from '@nimiq/electrum-client';
import { IAssetHandler } from './IAssetHandler';

export class BitcoinAssetHandler implements IAssetHandler<TransactionDetails> {
    private client: ElectrumClient;

    constructor(client: ElectrumClient) {
        this.client = client;
    }

    public async findTransaction(
        address: string,
        test: (tx: TransactionDetails) => boolean,
    ): Promise<TransactionDetails> {
        // eslint-disable-next-line no-async-promise-executor
        return new Promise(async (resolve) => {
            const listener = (tx: TransactionDetails) => {
                if (!test(tx)) return false;

                this.client.removeListener(handle);
                resolve(tx);
                return true;
            };

            // First subscribe to new transactions
            const handle = this.client.addTransactionListener(listener, [address]);

            // Then check history
            const history = await this.client.getTransactionsByAddress(address);
            for (const tx of history) {
                if (listener(tx)) break;
            }
        });
    }

    public async awaitHtlcCreation(
        address: string,
        value: number,
        data?: string,
        onPending?: (tx: TransactionDetails) => any,
    ): Promise<TransactionDetails> {
        return this.findTransaction(
            address,
            (tx) => {
                const htlcOutput = tx.outputs.find((out) => out.address === address);
                if (!htlcOutput) return false;
                if (htlcOutput.value !== value) return false;

                if (tx.replaceByFee) {
                    // Must wait until mined
                    if (tx.state === TransactionState.MINED || tx.state === TransactionState.CONFIRMED) return true;

                    if (typeof onPending === 'function') onPending(tx);

                    return false;
                }

                return true;
            },
        );
    }

    public async awaitHtlcSettlement(
        address: string,
        data: string,
    ): Promise<TransactionDetails> {
        return this.findTransaction(
            address,
            (tx) => tx.inputs.some((input) => input.address === address
                && typeof input.witness[4] === 'string' && input.witness[4] === data),
        );
    }
}
