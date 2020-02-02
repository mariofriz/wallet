import { createStore } from 'pinia'
import { useAccountStore } from './Account'

export type AddressState = {
    addressInfos: {[id: string]: AddressInfo},
    activeAddress: string | null,
}

// Mirror of Nimiq.Account.Type
export enum AddressType {
    BASIC = 0,
    VESTING = 1,
    HTLC = 2,
}

export type AddressInfo = {
    address: string,
    type: AddressType,
    label: string,
    balance: number | null,
}

export const useAddressStore = createStore({
    id: 'addresses',
    state: () => ({
        addressInfos: {},
        activeAddress: null,
    } as AddressState),
    getters: {
        addressInfos: (state): AddressInfo[] => {
            const accountStore = useAccountStore();
            return accountStore.activeAccountInfo.value
                ? accountStore.activeAccountInfo.value.addresses.map(addr => state.addressInfos[addr])
                : [];
        },
        activeAddress: state => state.activeAddress,
        activeAddressInfo: state => state.activeAddress && state.addressInfos[state.activeAddress],
        accountBalance: (state, { addressInfos }) => (addressInfos.value as AddressInfo[]).reduce((sum, acc) => sum + (acc.balance || 0), 0),
    },
    actions: {
        selectAddress(address: string) {
            this.state.activeAddress = address
        },
        addAddressInfo(addressInfo: AddressInfo, selectIt = true) {
            // Need to re-assign the whole object in Vue 2 for change detection.
            // TODO: Only add new addressInfo in Vue 3.
            this.state.addressInfos = {
                ...this.state.addressInfos,
                [addressInfo.address]: addressInfo,
            };

            if (selectIt) this.state.activeAddress = addressInfo.address;
        },
        setAddressInfos(addressInfos: AddressInfo[]) {
            const newAddressInfos: {[address: string]: AddressInfo} = {}

            for (const addressInfo of addressInfos) {
                newAddressInfos[addressInfo.address] = addressInfo
            }

            this.state.addressInfos = newAddressInfos;

            // If no address selected yet, or selected address does not exist anymore, select the first available.
            if (!this.state.activeAddress || !this.state.addressInfos[this.state.activeAddress]) {
                this.state.activeAddress = addressInfos[0].address;
            }

            // TODO: Remove transactions that became obsolete because their address was removed?
        },
        updateBalance(address: string, balance: number) {
            this.state.addressInfos[address].balance = balance
            // this.state.addressInfos[address] = {
            //     ...this.state.addressInfos[address],
            //     balance,
            // }
        },
    },
})