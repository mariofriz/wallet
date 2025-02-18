<template>
    <div class="swap-balance-bar flex-column" ref="root" :class="{ animating: animatingBars }">
        <div class="balance-bar-header flex-row">
            <button class="reset nimiq flex-row"
                :class="{ single: backgroundAddresses.length === 0 }"
                @click="onActiveAddressClick"
            >
                <div class="identicon-stack" ref="$nimiqIcon">
                    <Identicon class="secondary" v-if="backgroundAddresses[0]" :address="backgroundAddresses[0]"/>
                    <Identicon class="secondary" v-if="backgroundAddresses[1]" :address="backgroundAddresses[1]"/>
                    <Identicon class="primary" :address="activeAddressInfo.address"/>
                </div>
                <label>{{ activeAddressInfo.label }}</label>
            </button>
            <div class="bitcoin flex-row">
                <label>Bitcoin</label>
                <BitcoinIcon ref="$bitcoinIcon"/>
            </div>
        </div>
        <div class="connecting-lines">
            <CurvedLine :width="nimiqConnectingLineWidth" :height="35" direction="right" />
            <CurvedLine :width="bitcoinConnectingLineWidth" :height="35" direction="left" />
        </div>
        <div class="balance-bar flex-row">
            <div class="bar flex-row"
                v-for="addressInfo in nimDistributionData"
                :key="addressInfo.address"
                :ref="addressInfo.active ? '$activeBar' : null"
                :class="[{ active: addressInfo.active }, addressInfo.barColorClass]"
                :style="{ width: `${getNimiqBarWidth(addressInfo)}%` }"
                @click="addressInfo.active ? onActiveBarClick('NIM', $event) : selectAddress(addressInfo.address)"
            >
                <div class="change"
                    ref="$nimChangeBar"
                    :style="{ width: `${getNimiqChangeBarWidth(addressInfo)}%` }"
                ></div>
            </div>
            <div class="separator nq-light-blue-bg" ref="$separator">
                <transition name="fade">
                    <SlideHint direction="left" v-if="distributionPercents.btc <= 2"/>
                </transition>
                <div class="handle"
                    @mousedown="onMouseDown"
                    @touchstart="onMouseDown"
                ></div>
                <transition name="fade">
                    <SlideHint direction="right" v-if="distributionPercents.nim <= 2"/>
                </transition>
            </div>
            <div class="bar bitcoin active"
                ref="$bitcoinBar"
                :style="{ width: `${bitcoinBarWidth}%` }"
                @click="onActiveBarClick('BTC', $event)"
            >
                <div class="change"
                    ref="$btcChangeBar"
                    :style="{ width: `${bitcoinChangeBarWidth}%` }"
                ></div>
            </div>
        </div>
        <div class="scale flex-row">
            <div v-for="index in 10" :key="index" class="tenth">
                <div v-if="index === 1"
                    class="nimiq-total-percent"
                    :class="{
                        hidden: distributionPercents.nim <= 5 || (equiPointPositionX < 10 && equiPointPositionX > 5),
                    }"
                >{{distributionPercents.nim}}%</div>
                <div v-else-if="index === 10"
                    class="bitcoin-total-percent"
                    :class="{
                        hidden: distributionPercents.btc <= 5 || (equiPointPositionX > 90 && equiPointPositionX < 95),
                    }"
                >{{distributionPercents.btc}}%</div>
            </div>
        </div>
        <div class="equilibrium-point nq-light-blue-bg"
            :class="{
                hidden: !equiPointVisible || equiPointPositionX <= 5 || equiPointPositionX >= 95,
            }"
            :style="{ left: `${equiPointPositionX}%` }"
            @click="animatedReset"
        ></div>
    </div>
</template>

<script lang="ts">
import { defineComponent, computed, onMounted, onUnmounted, ref } from '@vue/composition-api';
import { Identicon } from '@nimiq/vue-components';
import { SwapAsset } from '@nimiq/fastspot-api';
import { useBtcAddressStore } from '../../stores/BtcAddress';
import { useFiatStore } from '../../stores/Fiat';
import { CryptoCurrency } from '../../lib/Constants';
import { useAddressStore, AddressInfo } from '../../stores/Address';
import BitcoinIcon from '../icons/BitcoinIcon.vue';
import CurvedLine from '../icons/SwapBalanceBar/CurvedLine.vue';
import SlideHint from '../icons/SwapBalanceBar/SlideHint.vue';
import { getColorClass } from '../../lib/AddressColor';

type ExtendedAddressInfo = AddressInfo & {
    readonly active: boolean,
    readonly newFiatBalance: number,
    readonly barColorClass: string,
    readonly balanceChange: number,
    readonly fiatBalanceChange: number,
}

enum MovingDirection {
    RIGHT = 1,
    LEFT = -1,
}

export default defineComponent({
    name: 'swap-balance-bar',
    props: {
        newBtcBalance: {
            type: Number,
            required: true,
        },
        newNimBalance: {
            type: Number,
            required: true,
        },
        satsPerNim: {
            type: Number,
            required: true,
        },
        limits: {
            type: Object as () => ({ fiat?: number, btc?: number, nim?: number }),
            validator: (limits: { fiat?: number, btc?: number, nim?: number }) =>
                (limits.fiat ? typeof limits.fiat === 'number' : true)
                && (limits.btc ? typeof limits.btc === 'number' : true)
                && (limits.nim ? typeof limits.nim === 'number' : true),
        },
    },
    setup(props, context) {
        const { addressInfos, selectAddress, activeAddressInfo } = useAddressStore();
        const { accountBalance } = useBtcAddressStore();
        const { exchangeRates, currency } = useFiatStore();

        const root = ref<HTMLDivElement | null>(null);

        const nimExchangeRate = computed(() =>
            exchangeRates.value?.[CryptoCurrency.NIM][currency.value] || 0);
        const btcExchangeRate = computed(() =>
            exchangeRates.value?.[CryptoCurrency.BTC][currency.value] || 0);

        const nimDistributionData = computed<readonly ExtendedAddressInfo[]>(() =>
            addressInfos.value
                .map((addressInfo) => ({
                    ...addressInfo,
                    get active() {
                        return (activeAddressInfo.value?.address === this.address);
                    },
                    get newFiatBalance() {
                        if (!this.active) {
                            return ((this.balance || 0) / 1e5) * nimExchangeRate.value;
                        }

                        return (props.newNimBalance / 1e5) * nimExchangeRate.value;
                    },
                    get balanceChange() {
                        if (!this.active) return 0;

                        return (props.newNimBalance - (this.balance || 0));
                    },
                    get fiatBalanceChange() {
                        return (this.balanceChange / 1e5) * nimExchangeRate.value;
                    },
                    get barColorClass() {
                        return getColorClass(this.address);
                    },
                } as ExtendedAddressInfo)),
        );
        const btcDistributionData = computed(() => ({
            newFiatBalance: (props.newBtcBalance / 1e8) * btcExchangeRate.value,
            balanceChange: (props.newBtcBalance - accountBalance.value),
            fiatBalanceChange: ((props.newBtcBalance - accountBalance.value) / 1e8) * btcExchangeRate.value,
        }));
        const nimiqTotalNewFiatBalance = computed(() =>
            nimDistributionData.value.reduce((sum, data) => sum + data.newFiatBalance, 0),
        );
        const totalNewFiatBalance = computed(() =>
            nimiqTotalNewFiatBalance.value + btcDistributionData.value.newFiatBalance,
        );
        const distributionPercents = computed(() => ({
            nim: Math.round((nimiqTotalNewFiatBalance.value / totalNewFiatBalance.value) * 100),
            btc: Math.round((btcDistributionData.value.newFiatBalance / totalNewFiatBalance.value) * 100),
        }));

        // handle behavior
        let isGrabbing = false;
        let initialCursorPosition = 0;
        let currentCursorPosition = 0;
        let animationFrameHandle = 0;

        const $bitcoinBar = ref<HTMLDivElement | null>(null);
        const $activeBar = ref<HTMLDivElement[] | null>(null);
        const activeBar = computed(() =>
            nimDistributionData.value.find((addressInfo) => addressInfo.active),
        );

        function onMouseDown(event: MouseEvent | TouchEvent) {
            isGrabbing = true;
            if (event instanceof MouseEvent) {
                initialCursorPosition = event.pageX;
                currentCursorPosition = event.pageX;
            } else {
                initialCursorPosition = event.touches[0].pageX;
                currentCursorPosition = event.touches[0].pageX;
            }
        }

        function onMouseUp(/* event: MouseEvent | TouchEvent */) {
            isGrabbing = false;
        }

        function onMouseMove(event: MouseEvent | TouchEvent) {
            if (!isGrabbing) return;

            if (event instanceof MouseEvent) {
                currentCursorPosition = event.pageX;
            } else {
                currentCursorPosition = event.touches[0].pageX;
            }
        }

        function emit(asset: SwapAsset, amount: number) {
            context.emit('change', {
                asset,
                amount: Math.ceil(amount),
            });
        }

        function updateSwapBalanceBar(cursorPosition?: number) {
            if ((!isGrabbing && !cursorPosition) || !$activeBar.value || !$bitcoinBar.value || !activeBar.value
                || !root.value || !$separator.value) {
                return undefined;
            }

            const separatorPositionX = $separator.value.getBoundingClientRect().left;

            /* initialize the initialCursorPosition to the handle/separator position if not set yet */
            if (initialCursorPosition === 0) initialCursorPosition = separatorPositionX;

            const cursorPositionDiff = (cursorPosition || currentCursorPosition) - initialCursorPosition;
            initialCursorPosition = (cursorPosition || currentCursorPosition);

            if (cursorPositionDiff === 0) return undefined;

            const movingDirection = cursorPositionDiff > 0 ? MovingDirection.RIGHT : MovingDirection.LEFT;
            const cursorSeparatorPositionDiff = (cursorPosition || currentCursorPosition) - separatorPositionX;

            /* Prevent moving the handle if the mouse is not above it anymore */
            if (cursorSeparatorPositionDiff < 0 && movingDirection === MovingDirection.RIGHT) return undefined;
            if (cursorSeparatorPositionDiff > 0 && movingDirection === MovingDirection.LEFT) return undefined;

            /* Amounts calculation */
            const fiatAmount = (Math.abs(cursorSeparatorPositionDiff) / root.value.clientWidth)
                * totalNewFiatBalance.value;
            const lunaAmount = activeBar.value.balanceChange
                + (((fiatAmount / nimExchangeRate.value) * 1e5) * movingDirection);
            const satoshiAmount = btcDistributionData.value.balanceChange
                + (((fiatAmount / btcExchangeRate.value) * 1e8) * -movingDirection);

            /* Limits */
            if (props.limits && typeof props.limits.fiat === 'number') {
                if ((lunaAmount / 1e5) * nimExchangeRate.value < -props.limits.fiat
                    && movingDirection === MovingDirection.LEFT) {
                    return emit(SwapAsset.NIM, -(props.limits.fiat / nimExchangeRate.value) * 1e5);
                }
                if ((satoshiAmount / 1e8) * btcExchangeRate.value < -props.limits.fiat
                    && movingDirection === MovingDirection.RIGHT) {
                    return emit(SwapAsset.BTC, -(props.limits.fiat / btcExchangeRate.value) * 1e8);
                }
            }

            /* Don't allow to send more than the available balance */
            if (lunaAmount < -(activeBar.value.balance || 0) && movingDirection === MovingDirection.LEFT) {
                return emit(SwapAsset.NIM, -(activeBar.value.balance || 0));
            }
            if (satoshiAmount < -accountBalance.value && movingDirection === MovingDirection.RIGHT) {
                return emit(SwapAsset.BTC, -accountBalance.value);
            }

            /* Otherwise, normal behavior */
            if (lunaAmount <= 0) {
                return emit(SwapAsset.NIM, lunaAmount);
            }
            return emit(SwapAsset.BTC, satoshiAmount);
        }

        function render(): void {
            animationFrameHandle = requestAnimationFrame(render);

            updateSwapBalanceBar();

            /*
                There is a lot of issues when updating those in a watcher, or turning them into computed.
                So we're updating them in the render loop until a more optimized way to do it is found.
            */
            updateConnectingLinesWidth();
            updateEquiPointVisibility();
        }

        onMounted(() => {
            document.body.addEventListener('mouseup', onMouseUp);
            document.body.addEventListener('touchend', onMouseUp);
            document.body.addEventListener('mousemove', onMouseMove);
            document.body.addEventListener('touchmove', onMouseMove);
            render();
        });

        onUnmounted(() => {
            document.body.removeEventListener('mouseup', onMouseUp);
            document.body.removeEventListener('touchend', onMouseUp);
            document.body.removeEventListener('mousemove', onMouseMove);
            document.body.removeEventListener('touchmove', onMouseMove);
            cancelAnimationFrame(animationFrameHandle);
        });

        /* Bars' width */
        const widthToSubstractPercent = computed(() => Math.round(
            root.value ? (((0.625 * remSize.value) // separator right margin & width
            + ((nimDistributionData.value.length - 1) * (0.875 * remSize.value))) // bar right margin & border width
            / root.value.offsetWidth) * 100 : 0,
        ) / 100);

        const getNimiqBarWidth = (addressInfo: ExtendedAddressInfo) =>
            (addressInfo.newFiatBalance / (totalNewFiatBalance.value * (1 + widthToSubstractPercent.value))) * 100;
        const getNimiqChangeBarWidth = (addressInfo: ExtendedAddressInfo) =>
            addressInfo.balanceChange > 0
                ? (addressInfo.fiatBalanceChange / addressInfo.newFiatBalance) * 100
                : 0;
        const bitcoinBarWidth = computed(() =>
            (btcDistributionData.value.newFiatBalance
            / (totalNewFiatBalance.value * (1 + widthToSubstractPercent.value))) * 100,
        );
        const bitcoinChangeBarWidth = computed(() =>
            btcDistributionData.value.balanceChange > 0
                ? (btcDistributionData.value.fiatBalanceChange / btcDistributionData.value.newFiatBalance) * 100
                : 0,
        );

        /* Connecting lines between icon and active bar */
        const remSize = computed(() => parseFloat(getComputedStyle(document.documentElement).fontSize));
        const nimiqConnectingLineWidth = ref(0);
        const bitcoinConnectingLineWidth = ref(0);

        function updateConnectingLinesWidth() {
            if ($activeBar.value && $activeBar.value[0].parentElement) {
                nimiqConnectingLineWidth.value = ($activeBar.value[0].offsetWidth / 2)
                    + ($activeBar.value[0].offsetLeft) - (remSize.value * 2.5);
            }

            if ($bitcoinBar.value) {
                bitcoinConnectingLineWidth.value = ($bitcoinBar.value.offsetWidth / 2) - (remSize.value * 2.5);
            }
        }

        /* Equilibrium point */
        const $separator = ref<HTMLDivElement | null>(null);
        const $btcChangeBar = ref<HTMLDivElement | null>(null);
        const $nimChangeBar = ref<HTMLDivElement[] | null>(null);
        const equiPointThreshold = 8;
        const equiPointPositionX = ref(0);
        const equiPointVisible = ref(false);
        const animatingBars = ref(false);

        function updateEquiPointVisibility() {
            if (!root.value || !$separator.value) {
                return;
            }

            const { offsetLeft } = $separator.value;

            /* hide the point if close to the handle/separator */
            if (equiPointPositionX.value < ((offsetLeft + equiPointThreshold) / root.value.offsetWidth) * 100
                && equiPointPositionX.value > ((offsetLeft - equiPointThreshold) / root.value.offsetWidth) * 100) {
                equiPointVisible.value = false;
            } else {
                equiPointVisible.value = true;
            }
        }

        onMounted(() => {
            const { offsetLeft } = $separator.value!;
            equiPointPositionX.value = (offsetLeft / root.value!.offsetWidth) * 100;
        });

        function animatedReset() {
            animatingBars.value = true;
            emit(SwapAsset.NIM, 0);
            setTimeout(() => {
                animatingBars.value = false;
            }, 200);
        }

        /* For the .identicon-stack */
        const backgroundAddresses = computed(() =>
            // TODO: show next/first & previous/last address
            addressInfos.value
                .filter((addressInfo) => addressInfo.address !== activeAddressInfo.value!.address)
                .slice(0, 2)
                .map((addressInfo) => addressInfo.address),
        );

        /* Emit click on active address for address selector overlay */
        function onActiveAddressClick() {
            if (!backgroundAddresses.value || backgroundAddresses.value.length === 0) return;

            context.emit('onActiveAddressClick');
        }

        /* Move the separator to the cursor position or limit on click on a btc or nim active bar */
        let activeBarClickTimeoutId = 0;
        function onActiveBarClick(asset: SwapAsset, event: MouseEvent) {
            if (!$separator.value || !event.target || !Object.values(SwapAsset).includes(asset)) {
                return;
            }

            clearTimeout(activeBarClickTimeoutId);
            animatingBars.value = true;

            if (asset === SwapAsset.NIM) {
                const posX = $separator.value.getBoundingClientRect().left
                    - ((event.target as HTMLElement).offsetWidth - event.offsetX);

                updateSwapBalanceBar(posX);
            } else if (asset === SwapAsset.BTC) {
                updateSwapBalanceBar(event.pageX);
            }

            activeBarClickTimeoutId = window.setTimeout(() => {
                animatingBars.value = false;
            }, 200);
        }

        return {
            /* store methods */
            selectAddress,

            /* HTML elements */
            root,
            $activeBar,
            $bitcoinBar,
            $btcChangeBar,
            $nimChangeBar,
            $separator,

            /* btc & nim distribution data */
            activeAddressInfo,
            nimDistributionData,
            btcDistributionData,

            /* Base slider (bars / separator) behavior */
            onMouseDown,
            onMouseUp,
            onMouseMove,
            getNimiqBarWidth,
            getNimiqChangeBarWidth,
            bitcoinBarWidth,
            bitcoinChangeBarWidth,

            /* Connecting lines */
            nimiqConnectingLineWidth,
            bitcoinConnectingLineWidth,

            /* Scale / distribution percents */
            nimiqTotalNewFiatBalance,
            distributionPercents,

            /* Equilibrium point */
            equiPointPositionX,
            equiPointVisible,
            animatedReset,
            animatingBars,

            /* Address selector / identicon stack */
            onActiveAddressClick,
            backgroundAddresses,

            /* Move separator/handle on btc or nim active bar click */
            onActiveBarClick,
        };
    },
    components: {
        BitcoinIcon,
        Identicon,
        CurvedLine,
        SlideHint,
    },
});
</script>

<style lang="scss" scoped>

.swap-balance-bar {
    position: relative;
}

.balance-bar-header {
    --header-height: 5.25rem;
    height: var(--header-height);

    & > * {
        flex-grow: 1;
        align-items: center;

        label {
            font-weight: 600;
            line-height: 2.625rem;
        }
    }
}

.balance-bar-header .nimiq {
    max-width: 65%;
    position: relative;

    &:not(.single) {
        &:before {
            content: "";
            border-radius: 0.75rem;
            position: absolute;
            top: -.5rem;
            bottom: -.5rem;
            left: -.5rem;
            right: -.5rem;
            background: transparent;

            transition: background 400ms;
        }

        &:hover:before {
            background: var(--nimiq-highlight-bg);
        }
    }

    &.single {
        cursor: default;
    }

    label {
        text-overflow: ellipsis;
        white-space: nowrap;
        overflow: hidden;
        cursor: inherit;
    }
}

.balance-bar-header .bitcoin {
    justify-content: flex-end;

    svg {
        margin-left: 2rem;
        color: var(--bitcoin-orange);
    }
}

.identicon-stack {
    align-items: stretch;
    position: relative;
    margin-right: 1.5rem;
    margin-left: 1rem;
    overflow: visible;

    .identicon {
        height: auto;
    }

    .primary {
        position: relative;
        width: var(--header-height);
    }

    .secondary {
        width: 4.75rem;
        position: absolute;
        top: 50%;

        opacity: 0.4;
        transform: translateY(-50%) translateX(0);

        transition:
            transform 300ms var(--nimiq-ease),
            opacity 300ms var(--nimiq-ease);

        &:first-child {
            left: 1.5rem;
        }

        &:nth-child(2) {
            right: 1.5rem;
        }
    }

    .nimiq:hover &,
    .nimiq:focus & {
        .secondary:first-child {
            transform: translateY(-50%) translateX(-0.375rem) scale(1.05);
            opacity: 0.5;
        }

        .secondary:nth-child(2) {
            transform: translateY(-50%) translateX(0.375rem) scale(1.05);
            opacity: 0.5;
        }
    }
}

.connecting-lines {
    margin-top: .5rem;
    margin-bottom: -3rem;
    padding-left: 3.5rem;

    svg:last-child {
        position: absolute;
        right: 2.5rem;
    }
}

.balance-bar {
    align-items: center;
}

.bar {
    height: 4.5rem;
    border-radius: 0.5rem;
    background-color: currentColor;
    border: .25rem solid currentColor;
    opacity: 0.25;
    align-items: center;
    justify-content: flex-end;
    overflow: hidden;
    cursor: pointer;
    transform: translate3d(0, 0, 0);

    transition: opacity 300ms;

    .animating & {
        transition: opacity 300ms, width 300ms;
    }

    &:not(:last-child) {
        margin-right: 0.375rem;
    }

    &:first-child,
    &:last-child {
        border-radius: 1.2rem; // css bug? increasing left border radius decrease the right one... Should be 0.5rem
        --end-border-radius: 5rem;
    }

    &:first-child {
        border-top-left-radius: var(--end-border-radius);
        border-bottom-left-radius: var(--end-border-radius);
    }

    &:last-child {
        border-top-right-radius: var(--end-border-radius);
        border-bottom-right-radius: var(--end-border-radius);
    }

    &.active {
        opacity: 1;
        cursor: default;
    }

    &.bitcoin {
        background-color: var(--bitcoin-orange);
        border: .25rem solid var(--bitcoin-orange);
        justify-content: flex-start;

        .change {
            background-position: top right;
        }
    }

    .change {
        background: url('../../assets/swap-change-background.svg') repeat-x top left;
        background-size: auto 100%;
        height: 100%;
        border-radius: 0.25rem;
        transform: translate3d(0, 0, 0);

        .animating & {
            transition: width 300ms;
        }
    }
}

.separator {
    width: .25rem;
    margin-right: 0.375rem;
    height: 10.5rem;
    position: relative;
    flex-shrink: 0;
    touch-action: none;
    z-index: 2;

    .handle {
        --height: 3rem;
        --width: 3.25rem;

        height: var(--height);
        width: var(--width);
        background: white url('../../assets/horizontal-double-arrow.svg') no-repeat center;
        border-radius: 0.5rem;
        box-shadow:
            0px .5rem 2rem rgba(0, 0, 0, 0.07),
            0px .1875rem .375rem rgba(0, 0, 0, 0.05),
            0px .0421rem .25rem rgba(0, 0, 0, 0.025);

        position: absolute;
        top: calc(50% - (var(--height) / 2));
        left: calc(50% - (var(--width) / 2));
        cursor: grab;

        &:active {
            cursor: grabbing;
        }
    }
}

.equilibrium-point {
    height: .5rem;
    width: .5rem;
    border-radius: 50%;
    cursor: pointer;
    position: absolute;
    bottom: .25rem;
    opacity: 1;

    transition: opacity 0.3s var(--nimiq-ease);

    &.hidden {
        opacity: 0;
    }
}

.scale {
    margin-top: -1rem;
    width: 100%;
    justify-content: space-between;
    align-items: center;

    .tenth {
        height: 1rem;
        line-height: 1rem;
        width: 20%;
        font-weight: bold;
        font-size: 1.625rem;
        letter-spacing: 0.0625rem;
        color: var(--text-50);

        &:not(:last-child) {
            border-right: 0.1875rem solid var(--text-20);
        }

        &:last-child {
            text-align: right;
        }

        & > div {
            transition-property: visibility, opacity;
            transition-duration: 300ms;

            &.hidden {
                opacity: 0;
            }
        }
    }
}

</style>
