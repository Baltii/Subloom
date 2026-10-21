import { View } from "react-native";
import Svg, { Circle, G, Path, Rect } from "react-native-svg";
import { useTheme } from "../../theme/useTheme";
import { brandIdentity } from "../../brand/identity";

/** Decorative artwork follows the theme; the Subloom mark keeps its fixed brand colors. */
export function OnboardingArt({
  step,
  size = 360,
}: {
  step: number;
  size?: number;
}) {
  const { colors: c, isDark } = useTheme();
  const brandFill = isDark
    ? brandIdentity.colors.mint
    : brandIdentity.colors.green;
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Svg
        width={size}
        height={size * (300 / 360)}
        viewBox="0 0 360 300"
        aria-hidden
      >
        {step === 0 ? (
          <>
            <Path
              d="M58 248h244"
              stroke={c.heroArt}
              strokeWidth={3}
              strokeLinecap="round"
            />
            <G transform="rotate(-12 140 132)">
              <Rect
                x={74}
                y={43}
                width={151}
                height={174}
                rx={19}
                fill={c.heroArt}
              />
              <Rect
                x={87}
                y={56}
                width={125}
                height={148}
                rx={11}
                fill={c.surface}
              />
              <Path
                d="M112 89h38m-38 16h67m-67 17h51"
                stroke={c.secondary}
                strokeWidth={5}
                strokeLinecap="round"
              />
              <Circle cx={180} cy={163} r={18} fill={c.mintStrong} />
              <Path
                d="m173 163 5 5 10-11"
                stroke={c.primary}
                strokeWidth={3}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            </G>
            <G transform="rotate(9 233 144)">
              <Rect
                x={175}
                y={72}
                width={113}
                height={134}
                rx={17}
                fill={c.surface}
              />
              <Rect
                x={190}
                y={88}
                width={83}
                height={53}
                rx={9}
                fill={c.mintStrong}
              />
              <Path d="m225 103 17 12-17 12z" fill={c.primary} />
              <Path
                d="M193 159h60m-60 17h36"
                stroke={c.secondary}
                strokeWidth={5}
                strokeLinecap="round"
              />
            </G>
            <Path
              d="M65 150h81l18 17h131v62a20 20 0 0 1-20 20H85a20 20 0 0 1-20-20z"
              fill={c.primary}
            />
            <Path
              d="M65 166h222l-14 67a20 20 0 0 1-20 16H85a20 20 0 0 1-20-20z"
              fill={c.mintStrong}
            />
            <G transform="translate(150 183) scale(.75)" fill={brandFill}>
              <Path d={brandIdentity.markPath} />
            </G>
            <Path
              d="M279 60v20m-10-10h20"
              stroke={c.heroArt}
              strokeWidth={3}
              strokeLinecap="round"
            />
          </>
        ) : step === 1 ? (
          <>
            <G transform="rotate(-7 174 156)">
              <Rect
                x={68}
                y={53}
                width={218}
                height={198}
                rx={24}
                fill={c.heroArt}
              />
              <Rect
                x={58}
                y={43}
                width={218}
                height={198}
                rx={24}
                fill={c.surface}
              />
              <Path
                d="M82 43h170a24 24 0 0 1 24 24v34H58V67a24 24 0 0 1 24-24"
                fill={c.primary}
              />
              <Path
                d="M109 33v27m115-27v27"
                stroke={c.heroText}
                strokeWidth={9}
                strokeLinecap="round"
              />
              {[0, 1, 2].map((row) =>
                [0, 1, 2, 3].map((column) => (
                  <Circle
                    key={`${row}-${column}`}
                    cx={96 + column * 47}
                    cy={127 + row * 37}
                    r={6}
                    fill={c.heroArt}
                  />
                )),
              )}
              <Circle cx={190} cy={164} r={20} fill={c.mintStrong} />
              <Path
                d="m181 164 6 6 12-13"
                stroke={c.primary}
                strokeWidth={3}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            </G>
            <Circle cx={278} cy={215} r={45} fill={c.mintStrong} />
            <Path
              d="M258 223h40l-5-9v-12a15 15 0 0 0-30 0v12zm14 8a6 6 0 0 0 12 0"
              stroke={c.primary}
              strokeWidth={3}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
            <Path
              d="M249 193l-6-5m64 5 6-5"
              stroke={c.primary}
              strokeWidth={3}
              strokeLinecap="round"
            />
          </>
        ) : (
          <>
            <Path
              d="M61 234h238"
              stroke={c.heroArt}
              strokeWidth={3}
              strokeLinecap="round"
            />
            <Rect
              x={61}
              y={84}
              width={217}
              height={141}
              rx={17}
              fill={c.heroArt}
            />
            <Rect
              x={51}
              y={74}
              width={217}
              height={141}
              rx={17}
              fill={c.surface}
            />
            <Path
              d="M51 184h217v14a17 17 0 0 1-17 17H68a17 17 0 0 1-17-17z"
              fill={c.mintStrong}
            />
            <Path
              d="M140 215v18h40v-18m-55 19h70"
              stroke={c.heroText}
              strokeWidth={5}
              strokeLinecap="round"
              fill="none"
            />
            <G transform="translate(83 101) scale(.75)" fill={brandFill}>
              <Path d={brandIdentity.markPath} />
            </G>
            <Path
              d="M148 111h83m-83 17h59m-59 17h71"
              stroke={c.secondary}
              strokeWidth={5}
              strokeLinecap="round"
            />
            <G transform="rotate(9 271 185)">
              <Rect
                x={230}
                y={117}
                width={85}
                height={140}
                rx={17}
                fill={c.primary}
              />
              <Rect
                x={237}
                y={125}
                width={71}
                height={122}
                rx={11}
                fill={c.surface}
              />
              <Path
                d="M259 132h27"
                stroke={c.primary}
                strokeWidth={4}
                strokeLinecap="round"
              />
              <Circle cx={272} cy={182} r={23} fill={c.mintStrong} />
              <Path
                d="m262 183 7 7 14-16"
                stroke={c.primary}
                strokeWidth={3}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
              <Path
                d="M258 225h29"
                stroke={c.secondary}
                strokeWidth={4}
                strokeLinecap="round"
              />
            </G>
            <Path
              d="M189 50h58a15 15 0 0 0 0-30h-3a23 23 0 0 0-43 2h-8a14 14 0 0 0-4 28"
              fill={c.mintStrong}
            />
            <Path
              d="M281 52v34m-7-7 7 7 7-7"
              stroke={c.heroText}
              strokeWidth={3}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          </>
        )}
      </Svg>
    </View>
  );
}
