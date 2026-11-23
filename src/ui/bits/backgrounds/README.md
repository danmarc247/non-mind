# Background shaders (React Bits)

Import from `./index.js`: named exports or the `BACKGROUNDS` map. Each fills its parent (`100%` x `100%`), so give the parent a size. Gallery: `/bits-backgrounds.html` (dev server).

Common props on most: `className`, `style`, `speed`, `opacity`, `paused`, `dpr`, `lightMode`, `intro`.

| Component | Main props (defaults) | Look | Backend |
|---|---|---|---|
| Aurora | colorStops `['#5227FF','#7cff67','#5227FF']`, amplitude 1, blend 0.5, speed 1, height 0.45, glow 0.6 | Soft northern-lights curtain along the top edge | raw WebGL2 |
| Balatro | color1 `#DE443B`, color2 `#006BB4`, color3 `#162325`, contrast 3.5, swirl 0.25, speed 1, pixelSize 1.5 | Pixelated swirling paint (Balatro menu) | raw WebGL2 |
| ColorBends | colors `[]`, rotation 90, speed 0.2, scale 1, warpStrength 1, intensity 1.5, noise 0.15 | Flowing rainbow ribbons on dark | three |
| DarkVeil | color `#6b12ff`, speed 0.5, scale 1, warp 0, glow 0.4, grain 0.03, quality 0.5 | Dark misty veil with a colored glow | raw WebGL2 |
| Galaxy | starSpeed 0.5, density 1, hueShift 140, saturation 0, glowIntensity 0.3, twinkleIntensity 0.3, starColors, backgroundColor | Starfield flying forward, mouse repulsion | raw WebGL2 |
| GradientBlinds | gradientColors, angle 0, noise 0.3, blindCount 16, lightColor `#ffffff`, spotlightRadius 0.5, shine 0.4 | Vertical blinds with gradient and cursor spotlight | raw WebGL2 |
| Iridescence | color `[1,1,1]` (rgb 0-1), speed 1, amplitude 0.1, brightness 1.5, hueShift 0, saturation 1 | Pastel pearly liquid sheen | raw WebGL2 |
| LiquidChrome | color `#ffffff`, speed 0.2, amplitude 0.3, frequencyX/Y 3, roughness 0.3, exposure 1 | Rippling mercury/chrome, cursor ripples | raw WebGL2 |
| LiquidEther | colors `['#5227FF','#FF9FFC','#B497CF']`, intensity 1, mouseForce 20, cursorSize 100, viscosity 0, backgroundColor `transparent` | Fluid-simulation smoke following the cursor | raw WebGL2 |
| Plasma | color `#a6a3b8`, speed 1, direction `forward`, scale 1, twist 1, softness 0.5, brightness 1 | Smoky plasma clouds | raw WebGL2 |
| Prism | height 3.5, baseWidth 5.5, animationType `rotate`, glow 1, hueShift 0, colors, saturation 1.5, timeScale 0.5 | Glowing prism/pyramid with spectral edges | raw WebGL2 |
| PrismaticBurst | colors, intensity 2, speed 0.5, animationType `rotate3d`, rayCount 0, grain 0.8, mixBlendMode | Grainy radial rainbow ray burst | raw WebGL2 |
| Silk | speed 5, scale 1, color `#7B7481`, sheenColor `#ffffff`, noiseIntensity 1.5, rotation 0 | Draped silk fabric folds | raw WebGL2 |
| Threads | color `[1,1,1]` (rgb 0-1), accentColor, amplitude 1.7, lineCount 90, thickness 0.6, speed 0.6, angle 25 | Wavy bundle of fine thread lines | raw WebGL2 |

Notes: these versions of the sources are raw WebGL2 (no ogl), except ColorBends (three). Without WebGL the components render an empty container. Color props are hex strings unless noted as rgb arrays.

Adapted from React Bits (reactbits.dev), MIT + Commons Clause license. (Per the React Bits repo, github.com/DavidHDev/react-bits: MIT with the Commons Clause, i.e. free to use and modify but you may not sell the components themselves. Not verified from the downloaded sources, which carry no license header.)
