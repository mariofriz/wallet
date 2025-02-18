/* eslint-disable no-console */
import { ref, watch } from '@vue/composition-api';
import { SignedTransaction } from '@nimiq/hub-api';
import Config from 'config';

import { useAddressStore } from './stores/Address';
import { useTransactionsStore, TransactionState } from './stores/Transactions';
import { useNetworkStore } from './stores/Network';
import { useProxyStore } from './stores/Proxy';
import { loadNimiqJS } from './lib/NimiqJSLoader';
import { ENV_MAIN } from './lib/Constants';

let isLaunched = false;
let clientPromise: Promise<Nimiq.Client>;

type Balances = Map<string, number>;
const balances: Balances = new Map(); // Balances in Luna, excluding pending txs

export async function getNetworkClient() {
    // eslint-disable-next-line no-async-promise-executor
    clientPromise = clientPromise || new Promise(async (resolve) => {
        await loadNimiqJS();
        Nimiq.GenesisConfig[Config.environment === ENV_MAIN ? 'main' : 'test']();
        await Nimiq.WasmHelper.doImport();
        const client = Nimiq.Client.Configuration.builder().instantiateClient();
        resolve(client);
    });

    return clientPromise;
}

async function reconnectNetwork(peerSuggestions?: Nimiq.Client.PeerInfo[]) {
    const client = await getNetworkClient();

    // @ts-expect-error This method was added in v1.5.8, but not added to type declarations
    await client.resetConsensus();

    // Re-add deep listeners to new consensus
    subscribeToPeerCount();
    for (const [callback] of onPeersUpdatedCallbacks) {
        const [peersChangedId, addressAddedId] = await Promise.all([ // eslint-disable-line no-await-in-loop
            onNetworkPeersChanged(callback),
            onNetworkAddressAdded(callback),
        ]);
        onPeersUpdatedCallbacks.set(callback, {
            peersChangedId,
            addressAddedId,
        });
    }

    if (peerSuggestions && peerSuggestions.length > 0) {
        const interval = window.setInterval(() => {
            peerSuggestions.forEach((peer) => client.network.connect(peer.peerAddress));
        }, 1000);
        await client.waitForConsensusEstablished();
        window.clearInterval(interval);
    }
}

async function disconnectNetwork() {
    const client = await getNetworkClient();

    const peers = await client.network.getPeers();
    await Promise.all(peers.map(
        ({ peerAddress }) => client.network.disconnect(peerAddress),
    ));
    return peers;
}

const onPeersUpdatedCallbacks = new Map<() => any, {
    peersChangedId: number,
    addressAddedId: number,
}>();

export async function onPeersUpdated(callback: () => any) {
    const [peersChangedId, addressAddedId] = await Promise.all([
        onNetworkPeersChanged(callback),
        onNetworkAddressAdded(callback),
    ]);
    onPeersUpdatedCallbacks.set(callback, {
        peersChangedId,
        addressAddedId,
    });
}

export async function offPeersUpdated(callback: () => any) {
    const ids = onPeersUpdatedCallbacks.get(callback);
    if (!ids) return;

    const client = await getNetworkClient();

    // @ts-expect-error Private property access
    const consensus = await client._consensus as Nimiq.BaseMiniConsensus;
    consensus.network.off('peers-changed', ids.peersChangedId);
    consensus.network.addresses.off('added', ids.addressAddedId);
    onPeersUpdatedCallbacks.delete(callback);
}

async function onNetworkPeersChanged(callback: () => any) {
    const client = await getNetworkClient();

    // @ts-expect-error Private property access
    const consensus = await client._consensus as Nimiq.BaseMiniConsensus;
    return consensus.network.on('peers-changed', callback);
}

async function onNetworkAddressAdded(callback: () => any) {
    const client = await getNetworkClient();

    // @ts-expect-error Private property access
    const consensus = await client._consensus as Nimiq.BaseMiniConsensus;
    return consensus.network.addresses.on('added', callback);
}

async function subscribeToPeerCount() {
    return onNetworkPeersChanged(async () => {
        const client = await getNetworkClient();
        const statistics = await client.network.getStatistics();
        const peerCount = statistics.totalPeerCount;
        useNetworkStore().state.peerCount = peerCount;
    });
}

export async function launchNetwork() {
    if (isLaunched) return;
    isLaunched = true;

    const client = await getNetworkClient();

    const { state: network$ } = useNetworkStore();
    const transactionsStore = useTransactionsStore();
    const addressStore = useAddressStore();

    const subscribedAddresses = new Set<string>();
    const fetchedAddresses = new Set<string>();

    const subscribedProxies = new Set<string>();
    const seenProxies = new Set<string>();

    async function updateBalances(addresses: string[] = [...balances.keys()]) {
        if (!addresses.length) return;
        await client.waitForConsensusEstablished();
        const accounts = await client.getAccounts(addresses);
        const newBalances: Balances = new Map(
            accounts.map((account, i) => [addresses[i], account.balance]),
        );

        for (const [address, newBalance] of newBalances) {
            if (balances.get(address) === newBalance) {
                // Balance did not change since last check.
                // Remove from newBalances Map to not update the store.
                newBalances.delete(address);
            } else {
                // Update balances cache
                balances.set(address, newBalance);
            }
        }

        if (!newBalances.size) return;
        console.debug('Got new balances for', [...newBalances.keys()]);
        for (const [address, balance] of newBalances) {
            addressStore.patchAddress(address, { balance });
        }
    }

    function forgetBalances(addresses: string[]) {
        for (const address of addresses) {
            balances.delete(address);
        }
    }

    const txFetchTrigger = ref(0);
    function invalidateTransactionHistory(includeProxies = false) {
        // Invalidate fetched addresses
        fetchedAddresses.clear();
        // Trigger watcher
        txFetchTrigger.value += 1;

        // Do the same for proxies if requested
        if (includeProxies) {
            seenProxies.clear();
            proxyStore.triggerNetwork();
        }
    }

    // Start as true, since at app start everything is already invalidated and unconnected
    let txHistoryWasInvalidatedSinceLastConsensus = true;
    let networkWasReconnectedSinceLastConsensus = true;
    client.addConsensusChangedListener(async (consensus) => {
        network$.consensus = consensus;

        if (consensus === 'established') {
            const stop = watch(() => network$.fetchingTxHistory, (fetching) => {
                if (fetching === 0) {
                    txHistoryWasInvalidatedSinceLastConsensus = false;
                    stop();
                }
            }, { lazy: true });
            networkWasReconnectedSinceLastConsensus = false;
        } else if (!txHistoryWasInvalidatedSinceLastConsensus) {
            invalidateTransactionHistory(true);
            updateBalances();
            txHistoryWasInvalidatedSinceLastConsensus = true;
        }
    });

    let lastVisibilityFetch = Date.now();
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState !== 'visible') return;

        if (Date.now() - lastVisibilityFetch > Config.pageVisibilityTxRefreshInterval) {
            if (!txHistoryWasInvalidatedSinceLastConsensus) {
                invalidateTransactionHistory();
                lastVisibilityFetch = Date.now();
            }
        }

        // If network is disconnected when going back to app, trigger reconnect
        if (useNetworkStore().state.consensus === 'connecting' && !networkWasReconnectedSinceLastConsensus) {
            disconnectNetwork().then(reconnectNetwork);
            networkWasReconnectedSinceLastConsensus = true;
        }
    });

    let reconnectTimeout: number | undefined;
    window.addEventListener('offline', async () => {
        console.warn('Browser is OFFLINE');
        if (reconnectTimeout) window.clearTimeout(reconnectTimeout);
        disconnectNetwork();
    });
    window.addEventListener('online', () => {
        console.info('Browser is ONLINE');
        reconnectTimeout = window.setTimeout(() => {
            reconnectNetwork();
            reconnectTimeout = undefined;
        }, 1000);
    });

    client.addHeadChangedListener(async (hash) => {
        const { height } = await client.getBlock(hash, false);
        console.debug('Head is now at', height);
        network$.height = height;

        // The NanoApi did recheck all balances on every block
        // I don't think we need to do this here, as wallet addresses are only expected to
        // change in balance when sending or receiving a transaction, as they should not be mining
        // directly.
    });

    subscribeToPeerCount();

    function transactionListener(tx: Nimiq.Client.TransactionDetails) {
        const plain = tx.toPlain();
        transactionsStore.addTransactions([plain]);

        if (plain.state === TransactionState.MINED) {
            const addresses: string[] = [];
            if (balances.has(plain.sender)) {
                addresses.push(plain.sender);
            }
            if (balances.has(plain.recipient)) {
                addresses.push(plain.recipient);
            }
            updateBalances(addresses);
        }
    }

    function subscribe(addresses: string[]) {
        client.addTransactionListener(transactionListener, addresses);
        updateBalances(addresses);
        return true;
    }

    // Subscribe to new addresses (for balance updates and transactions)
    // Also remove logged out addresses from fetched (so that they get fetched on next login)
    watch(addressStore.addressInfos, () => {
        const newAddresses: string[] = [];
        const removedAddresses = new Set(subscribedAddresses);

        for (const address of Object.keys(addressStore.state.addressInfos)) {
            if (subscribedAddresses.has(address)) {
                removedAddresses.delete(address);
                continue;
            }

            subscribedAddresses.add(address);
            newAddresses.push(address);
        }

        if (removedAddresses.size) {
            for (const removedAddress of removedAddresses) {
                subscribedAddresses.delete(removedAddress);
                fetchedAddresses.delete(removedAddress);
            }
            // Let the network forget the balances of the removed addresses,
            // so that they are reported as new again at re-login.
            forgetBalances([...removedAddresses]);
        }

        if (!newAddresses.length) return;

        console.debug('Subscribing addresses', newAddresses);
        subscribe(newAddresses);
    });

    // Fetch transactions for active address
    watch([addressStore.activeAddress, txFetchTrigger], ([activeAddress]) => {
        const address = activeAddress as string | null;
        if (!address || fetchedAddresses.has(address)) return;
        fetchedAddresses.add(address);

        console.debug('Scheduling transaction fetch for', address);

        const knownTxDetails = Object.values(transactionsStore.state.transactions)
            .filter((tx) => tx.sender === address || tx.recipient === address);

        // const lastConfirmedHeight = knownTxDetails
        //     .filter((tx) => tx.state === TransactionState.CONFIRMED)
        //     .reduce((maxHeight, tx) => Math.max(tx.blockHeight!, maxHeight), 0);

        network$.fetchingTxHistory++;

        updateBalances([address]);

        // FIXME: Re-enable lastConfirmedHeight, but ensure it syncs from 0 the first time
        //        (even when cross-account transactions are already present)
        client.waitForConsensusEstablished()
            .then(() => {
                console.debug('Fetching transaction history for', address, knownTxDetails);
                return client.getTransactionsByAddress(address, /* lastConfirmedHeight - 10 */ 0, knownTxDetails);
            })
            .then((txDetails) => {
                transactionsStore.addTransactions(txDetails.map((tx) => tx.toPlain()));
            })
            .catch(() => fetchedAddresses.delete(address))
            .then(() => network$.fetchingTxHistory--);
    });

    // Fetch transactions for proxies
    const proxyStore = useProxyStore();
    watch(proxyStore.networkTrigger, () => {
        const newProxies: string[] = [];
        const addressesToSubscribe: string[] = [];
        for (const proxyAddress of proxyStore.allProxies.value) {
            if (!seenProxies.has(proxyAddress)) {
                // For new addresses the tx history and if required subscribing is handled below
                seenProxies.add(proxyAddress);
                newProxies.push(proxyAddress);
                continue;
            }

            // If we didn't subscribe in the first pass, subscribe on second pass if needed, see below.
            if (
                !subscribedProxies.has(proxyAddress)
                && proxyStore.state.funded.includes(proxyAddress)
                && proxyStore.state.claimed.includes(proxyAddress)
            ) {
                subscribedProxies.add(proxyAddress);
                addressesToSubscribe.push(proxyAddress);
            }
        }
        if (addressesToSubscribe.length) subscribe(addressesToSubscribe);
        if (!newProxies.length) return;

        console.debug(`Fetching history for ${newProxies.length} proxies`);

        for (const proxyAddress of newProxies) {
            const knownTxDetails = Object.values(transactionsStore.state.transactions)
                .filter((tx) => tx.sender === proxyAddress || tx.recipient === proxyAddress);

            network$.fetchingTxHistory++;

            client.waitForConsensusEstablished()
                .then(() => {
                    console.debug('Fetching transaction history for proxy', proxyAddress, knownTxDetails);
                    return client.getTransactionsByAddress(proxyAddress, 0, knownTxDetails);
                })
                .then((txDetails) => {
                    if (
                        proxyStore.state.funded.includes(proxyAddress)
                        && !subscribedProxies.has(proxyAddress)
                        && !txDetails.find((tx) => tx.sender.toUserFriendlyAddress() === proxyAddress
                            && tx.state === TransactionState.CONFIRMED)
                    ) {
                        // No claiming transactions found, or the claiming tx is not yet confirmed, so we might need to
                        // subscribe for updates.
                        // If we were triggered by a funding transaction, we have to subscribe in any case because we
                        // don't know when and to where the proxy will be claimed. If we were triggered by a claimed
                        // transaction and don't know the funding transaction yet wait with subscribing until the second
                        // pass to see whether we actually have to subscribe (which is for example not the case if
                        // funding and claiming are both from/to addresses that are subscribed anyways; see
                        // needToSubscribe in ProxyDetection).
                        // If the funding tx has not been known so far, it will be added to the transaction store below
                        // which in turn runs the ProxyDetection again and triggers the network and this watcher again
                        // for the second pass if needed.
                        subscribedProxies.add(proxyAddress);
                        subscribe([proxyAddress]);
                    }
                    transactionsStore.addTransactions(txDetails.map((tx) => tx.toPlain()));
                })
                .catch(() => seenProxies.delete(proxyAddress))
                .then(() => network$.fetchingTxHistory--);
        }
    });
}

export async function sendTransaction(tx: SignedTransaction | string) {
    const client = await getNetworkClient();
    const plain = await client.sendTransaction(typeof tx === 'string' ? tx : tx.serializedTx)
        .then((details) => details.toPlain());

    if (plain.state !== TransactionState.PENDING) {
        // Overwrite transaction status in the transactionStore,
        // because it got added as PENDING before by the transactionListener.
        useTransactionsStore().addTransactions([plain]);
    }

    return plain;
}

// @ts-expect-error debugging
window.gimmeclient = async function gimmeclient() {
    // @ts-expect-error debugging
    window.client = await getNetworkClient();
};
