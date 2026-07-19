<script lang="ts">
import I18nKey from "@i18n/i18nKey";
import { i18n } from "@i18n/translation";
import Icon from "@iconify/svelte";
import {
	getAccentColor,
	getAccentPosition,
	getDefaultAccentPosition,
	PREMIUM_ACCENT_GRADIENT,
	setAccentPosition,
} from "@utils/setting-utils";

let accentPosition = getAccentPosition();
const defaultAccentPosition = getDefaultAccentPosition();

$: accentColor = getAccentColor(accentPosition);
$: if (accentPosition || accentPosition === 0) {
	setAccentPosition(accentPosition);
}

function resetAccent() {
	accentPosition = defaultAccentPosition;
}
</script>

<div id="display-setting" class="float-panel float-panel-closed absolute transition-all w-80 right-4 px-5 py-5">
    <div class="flex flex-row gap-2 mb-4 items-center justify-between">
        <div class="flex gap-2 font-bold text-lg text-neutral-900 dark:text-neutral-100 transition relative ml-3
            before:w-1 before:h-4 before:rounded-md before:bg-[var(--primary)]
            before:absolute before:-left-3 before:top-[0.33rem]"
        >
            {i18n(I18nKey.themeColor)}
            <button aria-label="Reset to Default" class="btn-regular w-7 h-7 rounded-md active:scale-90 will-change-transform"
                    class:opacity-0={accentPosition === defaultAccentPosition} class:pointer-events-none={accentPosition === defaultAccentPosition} on:click={resetAccent}>
                <div class="text-[var(--btn-content)]">
                    <Icon icon="fa6-solid:arrow-rotate-left" class="text-[0.875rem]"></Icon>
                </div>
            </button>
        </div>
        <div class="flex gap-1">
            <div id="accentValue" class="transition bg-[var(--btn-regular-bg)] min-w-[5.75rem] h-7 px-2 rounded-md flex justify-center
            font-bold text-xs items-center text-[var(--btn-content)] tracking-normal">
                {accentColor}
            </div>
        </div>
    </div>
    <div class="accent-slider-shell w-full rounded-xl select-none">
        <input aria-label={i18n(I18nKey.themeColor)} type="range" min="0" max="100" bind:value={accentPosition}
               class="slider" id="colorSlider" step="1" style={`width: 100%; background-image: ${PREMIUM_ACCENT_GRADIENT}`}>
    </div>
</div>

<style lang="stylus">
    #display-setting
      border-color var(--theme-accent-border)
      box-shadow 0 18px 45px rgba(16, 24, 40, 0.16)

      .accent-slider-shell
        padding 0.875rem 0.75rem
        background var(--btn-plain-bg-hover)
        border 1px solid var(--theme-accent-border)
        box-shadow inset 0 1px 0 rgba(255, 255, 255, 0.45)

      input[type="range"]
        -webkit-appearance none
        appearance none
        height 0.5rem
        border-radius 9999px
        background-size 100% 100%
        background-repeat no-repeat
        cursor pointer
        outline none
        box-shadow inset 0 0 0 1px rgba(255, 255, 255, 0.55), 0 1px 3px rgba(16, 24, 40, 0.16)
        transition box-shadow 0.15s ease, filter 0.15s ease

        &:focus-visible
          box-shadow 0 0 0 3px var(--theme-accent-soft), 0 0 0 1px var(--accent-color), inset 0 0 0 1px rgba(255, 255, 255, 0.65)

        &::-webkit-slider-thumb
          -webkit-appearance none
          appearance none
          height 1rem
          width 1rem
          border-radius 9999px
          border 2px solid rgba(255, 255, 255, 0.95)
          background var(--accent-color)
          box-shadow 0 2px 8px rgba(16, 24, 40, 0.28)
          transition transform 0.15s ease, box-shadow 0.15s ease
          &:hover
            box-shadow 0 3px 10px rgba(16, 24, 40, 0.32)
          &:active
            transform scale(0.94)

        &::-moz-range-thumb
          height 1rem
          width 1rem
          border-radius 9999px
          border 2px solid rgba(255, 255, 255, 0.95)
          background var(--accent-color)
          box-shadow 0 2px 8px rgba(16, 24, 40, 0.28)
          transition transform 0.15s ease, box-shadow 0.15s ease
          &:hover
            box-shadow 0 3px 10px rgba(16, 24, 40, 0.32)
          &:active
            transform scale(0.94)

        &::-moz-range-track
          height 0.5rem
          border-radius 9999px
          background transparent
          border 0

        &::-ms-thumb
          height 1rem
          width 1rem
          border-radius 9999px
          border 2px solid rgba(255, 255, 255, 0.95)
          background var(--accent-color)
          box-shadow 0 2px 8px rgba(16, 24, 40, 0.28)

</style>