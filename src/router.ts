import VueRouter, { RouteConfig, Route } from 'vue-router';
import Vue from 'vue';
import { Component } from 'vue-router/types/router.d';

import { provide, inject } from '@vue/composition-api';

// Start views
import Groundfloor from './components/layouts/Groundfloor.vue';
import AccountOverview from './components/layouts/AccountOverview.vue';
import AddressOverview from './components/layouts/AddressOverview.vue';

import { AccountType, useAccountStore } from './stores/Account';

// Main views
const Settings = () => import(/* webpackChunkName: "settings" */ './components/layouts/Settings.vue');
const Network = () =>
    import(/* webpackChunkName: "network" */ './components/layouts/Network.vue');

// Modals
const AccountMenuModal = () =>
    import(/* webpackChunkName: "account-menu-modal" */ './components/modals/AccountMenuModal.vue');
const SendModal = () => import(/* webpackChunkName: "send-modal" */ './components/modals/SendModal.vue');
const ReceiveModal = () => import(/* webpackChunkName: "receive-modal" */ './components/modals/ReceiveModal.vue');
const AddressSelectorModal = () =>
    import(/* webpackChunkName: "address-selector-modal" */ './components/modals/AddressSelectorModal.vue');
const TransactionModal = () =>
    import(/* webpackChunkName: "transaction-modal" */ './components/modals/TransactionModal.vue');
const TradeModal = () => import(/* webpackChunkName: "trade-modal" */ './components/modals/TradeModal.vue');
const BuyOptionsModal = () =>
    import(/* webpackChunkName: "buy-options-modal" */ './components/modals/BuyOptionsModal.vue');
const ScanQrModal = () => import(/* webpackChunkName: "scan-qr-modal" */ './components/modals/ScanQrModal.vue');
const WelcomeModal = () =>
    import(/* webpackChunkName: "welcome-modal" */ './components/modals/WelcomeModal.vue');
const MigrationWelcomeModal = () =>
    import(/* webpackChunkName: "migration-welcome-modal" */ './components/modals/MigrationWelcomeModal.vue');
const DisclaimerModal = () =>
    import(/* webpackChunkName: "disclaimer-modal" */ './components/modals/DisclaimerModal.vue');
const ReleaseNotesModal = () =>
    import(/* webpackChunkName: "release-notes-modal" */ './components/modals/ReleaseNotesModal.vue');
const HistoryExportModal = () =>
    import(/* webpackChunkName: "history-export-modal" */ './components/modals/HistoryExportModal.vue');

// Bitcoin Modals
const BtcActivationModal = () =>
    import(/* webpackChunkName: "btc-activation-modal" */ './components/modals/BtcActivationModal.vue');
const BtcSendModal = () => import(/* webpackChunkName: "btc-send-modal" */ './components/modals/BtcSendModal.vue');
const BtcReceiveModal = () =>
    import(/* webpackChunkName: "btc-receive-modal" */ './components/modals/BtcReceiveModal.vue');
const BtcTransactionModal = () =>
    import(/* webpackChunkName: "btc-transaction-modal" */ './components/modals/BtcTransactionModal.vue');

// Swap Modals
const SwapModal = () => import(/* webpackChunkName: "swap-modal" */ './components/swap/SwapModal.vue');
const BuyCryptoModal = () =>
    import(/* webpackChunkName: "buy-crypto-modal" */ './components/modals/BuyCryptoModal.vue');
const SellCryptoModal = () =>
    import(/* webpackChunkName: "sell-crypto-modal" */ './components/modals/SellCryptoModal.vue');

const MoonpayModal = () =>
    import(/* webpackChunkName: "moonpay-modal" */ './components/modals/MoonpayModal.vue');
const SimplexModal = () =>
    import(/* webpackChunkName: "simplex-modal" */ './components/modals/SimplexModal.vue');

Vue.use(VueRouter);

export enum Columns {
    DYNAMIC,
    ACCOUNT,
    ADDRESS,
}

const routes: RouteConfig[] = [{
    path: '/',
    components: {
        groundfloor: Groundfloor,
    },
    children: [{
        path: '',
        components: {
            accountOverview: AccountOverview,
            addressOverview: AddressOverview,
        },
        name: 'root',
        alias: '/transactions',
        meta: { column: Columns.DYNAMIC },
        children: [{
            path: '/accounts',
            components: {
                modal: AccountMenuModal,
            },
            name: 'root-accounts',
            props: { modal: true },
            meta: { column: Columns.DYNAMIC },
        }, {
            path: '/send',
            components: {
                modal: AddressSelectorModal,
            },
            name: 'send',
            meta: { column: Columns.DYNAMIC },
        }, {
            path: '/send/nim',
            components: {
                modal: SendModal,
            },
            name: 'send-nim',
            meta: { column: Columns.DYNAMIC },
        }, {
            path: '/send/btc',
            components: {
                modal: BtcSendModal,
            },
            name: 'send-btc',
            meta: { column: Columns.DYNAMIC },
        }, {
            path: '/receive',
            components: {
                modal: AddressSelectorModal,
            },
            name: 'receive',
            meta: { column: Columns.DYNAMIC },
        }, {
            path: '/receive/nim',
            components: {
                modal: ReceiveModal,
            },
            name: 'receive-nim',
            meta: { column: Columns.DYNAMIC },
        }, {
            path: '/receive/btc',
            components: {
                modal: BtcReceiveModal,
            },
            name: 'receive-btc',
            meta: { column: Columns.DYNAMIC },
        }, {
            path: '/transaction/:hash',
            components: {
                modal: TransactionModal,
            },
            name: 'transaction',
            props: { modal: true },
            meta: { column: Columns.ADDRESS },
        }, {
            path: '/trade',
            components: {
                modal: TradeModal,
            },
            name: 'trade',
            props: { modal: true },
            meta: { column: Columns.DYNAMIC },
        }, {
            path: '/buy',
            components: {
                modal: BuyOptionsModal,
            },
            name: 'buy',
            props: { modal: true },
            meta: { column: Columns.DYNAMIC },
        }, {
            path: '/buy-crypto',
            components: {
                modal: BuyCryptoModal,
            },
            name: 'buy-crypto',
            props: { modal: true },
            meta: { column: Columns.DYNAMIC },
        }, {
            path: '/sell-crypto',
            components: {
                modal: SellCryptoModal,
            },
            name: 'sell-crypto',
            props: { modal: true },
            meta: { column: Columns.DYNAMIC },
        }, {
            path: '/scan',
            components: {
                modal: ScanQrModal,
            },
            name: 'scan',
            meta: { column: Columns.DYNAMIC },
        }, {
            path: '/nimiq\\::requestUri',
            components: {
                modal: SendModal,
            },
            name: 'send-via-uri',
            props: {
                modal: (route: Route) => ({ requestUri: route.fullPath.substr(1) }),
            },
            meta: { column: Columns.DYNAMIC },
        }, {
            path: '/welcome',
            components: {
                modal: WelcomeModal,
            },
            name: 'welcome',
            meta: { column: Columns.ACCOUNT },
        }, {
            path: '/migration-welcome',
            components: {
                modal: MigrationWelcomeModal,
            },
            name: 'migration-welcome',
            meta: { column: Columns.ACCOUNT },
        }, {
            path: '/btc-activation',
            components: {
                modal: BtcActivationModal,
            },
            name: 'btc-activation',
            props: { modal: true },
            meta: { column: Columns.ACCOUNT },
        }, {
            path: '/btc-transaction/:hash',
            components: {
                modal: BtcTransactionModal,
            },
            name: 'btc-transaction',
            props: { modal: true },
            meta: { column: Columns.ADDRESS },
        }, {
            path: '/bitcoin\\::requestUri',
            components: {
                modal: BtcSendModal,
            },
            name: 'send-via-btc-uri',
            props: {
                modal: (route: Route) => ({ requestUri: route.fullPath.substr(1) }),
            },
            meta: { column: Columns.DYNAMIC },
        }, {
            path: '/swap',
            components: {
                modal: SwapModal,
            },
            name: 'swap',
            props: { modal: true },
            meta: { column: Columns.ACCOUNT },
        }, {
            path: '/moonpay',
            components: {
                modal: MoonpayModal,
            },
            name: 'moonpay',
            props: { modal: true },
            meta: { column: Columns.DYNAMIC },
        }, {
            path: '/simplex',
            components: {
                'persistent-modal': SimplexModal,
            },
            name: 'simplex',
            // props: { modal: true },
            meta: { column: Columns.DYNAMIC },
        }, {
            path: '/release-notes',
            components: {
                modal: ReleaseNotesModal,
            },
            name: 'root-release-notes',
            props: { modal: true },
            meta: { column: Columns.DYNAMIC },
        }, {
            path: '/export-history/:type',
            components: {
                modal: HistoryExportModal,
            },
            name: 'export-history',
            props: { modal: true },
            meta: { column: Columns.ADDRESS },
        }],
    }, {
        path: '/settings',
        components: {
            settings: Settings,
        },
        name: 'settings',
        meta: { column: Columns.ACCOUNT },
        children: [{
            path: '/accounts',
            components: {
                modal: AccountMenuModal,
            },
            name: 'settings-accounts',
            props: { modal: true },
            meta: { column: Columns.DYNAMIC },
        }, {
            path: '/disclaimer',
            components: {
                modal: DisclaimerModal,
            },
            name: 'disclaimer',
            meta: { column: Columns.ACCOUNT },
        }, {
            path: '/release-notes',
            components: {
                modal: ReleaseNotesModal,
            },
            name: 'settings-release-notes',
            props: { modal: true },
            meta: { column: Columns.DYNAMIC },
        }],
    }],
}, {
    path: '/network',
    components: {
        basement: Network,
    },
    name: 'network',
    meta: { column: Columns.ACCOUNT },
    children: [{
        path: '/accounts',
        components: {
            modal: AccountMenuModal,
        },
        name: 'network-accounts',
        props: { modal: true },
        meta: { column: Columns.DYNAMIC },
    }, {
        path: '/release-notes',
        components: {
            modal: ReleaseNotesModal,
        },
        name: 'network-release-notes',
        props: { modal: true },
        meta: { column: Columns.DYNAMIC },
    }],
}];

// If wallet was opened on a path other than root route, for example on a modal, inject a root history entry before the
// actually requested route, such that a back navigation gets the user to the main wallet view, instead of leaving the
// wallet. This is especially for mobile, where hitting the back button to close a modal and open the main view feels
// more natural, like in a native app, and is also needed in general for modals to be closable by simple back navigation
// in modal.forceClose. Unfortunately though, in newer Chrome versions, hitting the back button skips history entries
// that have been inserted automatically without user interaction, see https://github.com/whatwg/html/issues/7832 and
// https://groups.google.com/a/chromium.org/g/blink-dev/c/T8d4_BRb2xQ/m/WSdOiOFcBAAJ. However, Interacting with the page
// _after_ the injection is also fine for activating the back button for the injected entry and programmatic back
// navigation via history.back also continues to work.
// We use the native history methods instead of the router and do the injection before initializing the router to avoid
// interference with the router's navigation guards which might also want to redirect the route, and to avoid having to
// wait for the router to initialize with the first view which only happens after the vue app is created in main.ts, for
// example by waiting for router.onReady, which also waits for the initial view's components to be loaded.
// If there's already a history state it means that the current history entry was already handled by our injection below
// or by the router (which adds a history state to all routes) and the page was simply reloaded, such that we don't need
// to run the injection logic again.
const initialUrl = window.location.href;
if (!window.history.state) {
    // Only return to the initial url if it's not on the root route, i.e. if another view or modal is supposed to be
    // opened. If it is on the root route, we don't add a second history entry for the root route, we do however close
    // the sidebar, if it's open, by stripping the sidebar parameter, and keep it closed.
    const shouldReturnToInitialUrl = new URL(initialUrl).pathname !== process.env.BASE_URL;
    const rootUrl = new URL(initialUrl);
    rootUrl.pathname = process.env.BASE_URL!;
    if (shouldReturnToInitialUrl) {
        // Can clear params and hash entirely as they're preserved in the initialUrl.
        rootUrl.search = '';
        rootUrl.hash = '';
    } else {
        // Only remove sidebar; preserve other search params and hash, especially rpc responses.
        rootUrl.searchParams.delete('sidebar');
    }

    window.history.replaceState({ injected: true }, '', rootUrl); // inject history entry for root route
    if (shouldReturnToInitialUrl) {
        window.history.pushState({ injected: true }, '', initialUrl);
    }
}

const router = new VueRouter({
    mode: 'history',
    base: process.env.BASE_URL,
    routes,
});

// Offer to activate Bitcoin if a route requires it, but it's not activated yet
const viewsRequiringActivatedBitcoin = new Set<Component>([BtcSendModal, BtcReceiveModal, SwapModal]);
router.beforeEach((to, from, next) => {
    const requiresActivatedBitcoin = to.matched.some(({ components }) =>
        Object.values(components).some((view) => viewsRequiringActivatedBitcoin.has(view)));
    const {
        activeAccountInfo: { value: activeAccount },
        hasBitcoinAddresses: { value: isBitcoinActivated },
    } = useAccountStore();
    const isLegacyAccount = !!activeAccount && activeAccount.type === AccountType.LEGACY;
    if (!requiresActivatedBitcoin || isBitcoinActivated) {
        // can continue to the requested view
        next();
    } else if (isLegacyAccount) {
        // legacy accounts don't support Bitcoin; go to main view
        next({
            name: 'root',
            replace: true,
        });
    } else {
        // open Bitcoin activation modal; store original target route in hash
        next({
            name: 'btc-activation',
            // Path including query and hash, but not origin. Encoded because the hash is parsed as URLSearchParams in
            // BtcActivationModal and also by the RPC api in case that the Hub BTC activation request is executed as
            // redirect.
            hash: `#redirect=${encodeURIComponent(to.fullPath)}`,
            replace: true,
        });
    }
});

export default router;

const RouterSymbol = Symbol('router');

export function provideRouter(providedRouter: VueRouter) {
    provide(RouterSymbol, providedRouter);
}

export function useRouter(): VueRouter {
    const injectedRouter = inject(RouterSymbol) as VueRouter;
    if (!injectedRouter) throw new Error('Router was not provided.');
    return injectedRouter;
}
