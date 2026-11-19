'use strict';

// The same original pencil paths power the lesson previews, animations and tracing guides.
// Each stage contains a title, an instruction, a technique cue and the paths to add.
const categories = {
  Animals: { tint: '#f4dcc6', accent: '#c98353', glyph: 'paw' },
  Food: { tint: '#f9dfdc', accent: '#c67b81', glyph: 'berry' },
  Fashion: { tint: '#e9ddf0', accent: '#9b75a8', glyph: 'shirt' },
  Nature: { tint: '#e2ead4', accent: '#7f9463', glyph: 'leaf' },
  Things: { tint: '#dce9ef', accent: '#668d9c', glyph: 'box' },
  Fantasy: { tint: '#f5e8c6', accent: '#af8a4a', glyph: 'sparkle' },
};

const lessons = [
  {
    id: 'little-fox', title: 'Little fox', category: 'Animals', minutes: 7, skill: 'Curves & texture',
    steps: [
      ['Sketch the head', 'Draw a wide, soft diamond. Curve the bottom edges down to a little point for the chin.', 'Keep your first lines light so you can reshape them.', 'M54 74 Q69 51 107 53 Q143 52 166 76 Q149 104 111 118 Q77 107 54 74Z'],
      ['Give it ears', 'Add a tall triangle at each corner of the head. Draw a smaller shape inside each ear.', 'Round the tips just a little.', 'M59 68 Q52 47 54 21 Q78 28 88 54', 'M136 55 Q151 31 173 23 Q175 52 160 70', 'M61 35 Q73 42 79 54 M149 54 Q155 43 167 34'],
      ['Sit the fox down', 'Curve from under the chin down to two little paws. Then draw a round haunch on the right.', 'Leave a small gap between the front paws.', 'M92 111 C81 128 78 144 77 158 Q68 163 73 171 Q82 176 94 172 Q99 163 99 148 M101 172 Q114 176 121 172 Q126 166 121 161 Q126 144 129 134', 'M134 110 C151 115 169 131 168 151 Q167 173 142 175 L121 172'],
      ['Curl the tail', 'Sweep a big curve from the fox’s back toward the right. Bend it around and bring it back under the body.', 'Try the long curve in one loose movement.', 'M163 134 C182 130 184 103 214 98 C218 133 200 170 151 175', 'M190 113 Q202 117 210 125'],
      ['Add a face and fur', 'Add two sleepy eyes, a small nose and cheek curves. Shade the ears and tail with short, slanted lines.', 'Leave the cheeks and tail tip light to make them stand out.', 'M78 79 Q84 73 91 81 M128 81 Q136 73 144 79', 'M103 95 Q110 92 118 95 L111 101Z M111 101 L111 105 Q107 109 102 106 M111 105 Q115 109 120 106', 'M58 79 Q85 84 108 115 M164 81 Q139 85 114 115', 'M60 39 L66 48 M66 43 L72 51 M157 47 L165 40 M154 53 L164 46 M184 139 L178 149 M190 138 L182 151 M197 134 L187 152 M148 152 L141 162 M154 152 L147 165'],
    ],
  },
  {
    id: 'strawberry', title: 'Strawberry', category: 'Food', minutes: 5, skill: 'Shape & pattern',
    steps: [
      ['Draw the berry', 'Start with two round shoulders. Taper both sides into a soft point at the bottom.', 'Think of a heart with the dip at the top filled in.', 'M121 61 C171 37 192 72 177 111 C166 145 139 178 120 178 C101 178 74 145 63 111 C48 72 69 37 121 61Z'],
      ['Add a leafy crown', 'Draw four pointed leaves around the center at the top. Let some leaves hang down over the fruit.', 'Vary the length and angle of the leaves.', 'M117 62 Q94 62 78 56 Q88 73 107 76 Q99 81 96 91 Q111 88 122 75 Q135 92 150 95 Q144 78 137 73 Q154 73 164 57 Q144 59 129 62'],
      ['Grow a stem', 'Draw two parallel curves up from between the leaves. Join them with a short line.', 'A slight bend makes the stem feel natural.', 'M116 63 Q112 50 116 38 L124 36 Q120 49 128 61'],
      ['Scatter the seeds', 'Draw small teardrop seeds in loose rows. Tilt the seeds near the sides inward.', 'Leave an unbroken strip on the left for a highlight.', 'M102 94 q-4 7 0 9 q5 0 3-7Z M126 95 q-5 7 0 9 q5-1 3-7Z M151 105 q-7 5-3 8 q5 1 6-6Z M81 107 q0 8 5 9 q4-3-2-8Z M110 119 q-4 7 1 9 q4-2 1-8Z M137 122 q-6 6-2 9 q5 0 6-6Z M99 136 q0 8 5 9 q4-3-2-8Z M123 147 q-4 7 0 9 q5-1 3-7Z M148 140 q-7 5-3 8 q5 1 7-6Z'],
      ['Shade the underside', 'Add soft diagonal strokes near the lower right. Make the marks closer together by the edge.', 'The untouched side of the berry will look brighter.', 'M167 113 L157 127 M162 127 L153 139 M153 143 L142 157 M144 156 L134 166 M134 166 L127 172 M102 160 L107 167 M110 165 L115 171'],
    ],
  },
  {
    id: 'high-top', title: 'High-top sneaker', category: 'Fashion', minutes: 8, skill: 'Shape & detail',
    steps: [
      ['Outline the shoe', 'Round the toe on the left. Make a low slope across the top, then lift the line for the tall ankle.', 'Keep the bottom edge long and almost flat.', 'M36 132 C33 115 46 106 66 105 L93 98 Q117 88 127 50 Q150 54 175 49 Q191 83 188 124 Q168 138 36 132Z'],
      ['Add a rubber sole', 'Follow the bottom edge with a second line. Round the corners and add a thin stripe inside the sole.', 'Keep the two long lines a similar distance apart.', 'M36 132 L36 147 Q43 156 72 156 Q147 162 190 145 L188 124', 'M40 142 Q111 154 187 136'],
      ['Draw the panels', 'Curve a line over the toe. Draw a tall heel panel and another curve that follows the ankle opening.', 'Use the outline to decide where each seam ends.', 'M64 106 Q84 116 82 135 M175 50 Q159 56 132 57 M163 57 Q172 85 168 129 M109 96 Q127 102 141 133'],
      ['Lace it up', 'Draw short, slightly tilted bars across the top. Add tiny dots where the laces attach.', 'Space the laces evenly up the slope.', 'M103 95 L121 101 M110 88 L127 94 M116 79 L133 85 M121 71 L138 76 M128 63 L144 68', 'M121 101 l2 1 M127 94 l2 1 M133 85 l2 1 M138 76 l2 1 M144 68 l2 1'],
      ['Add stitching', 'Follow the sole and heel seam with little dash marks. Shade the heel with a few light stripes.', 'Keep the stitches small and the stripes parallel.', 'M87 127 l4 0 m4 0 l4 0 m4 0 l4 0 m4 0 l4 0 m4 0 l4 0 M174 83 l3 3 m-2 4 l3 3 m-2 4 l3 3 m-2 4 l3 3 M176 112 l7 9 m-7-3 l5 6', 'M46 116 Q54 111 65 115 M48 120 Q54 117 64 119'],
    ],
  },
  {
    id: 'mushroom', title: 'Woodland mushroom', category: 'Nature', minutes: 6, skill: 'Shading',
    steps: [
      ['Curve the cap', 'Draw a wide dome. Start low on the left, rise over the middle and finish low on the right.', 'Give the cap a slightly uneven shape.', 'M48 106 C55 70 79 43 112 40 C150 34 180 62 192 106'],
      ['Show the underside', 'Connect the two ends with a shallow upward curve. Add another curve underneath for the thin rim.', 'The second arc makes the cap feel three-dimensional.', 'M48 106 C82 84 155 84 192 106 C170 127 76 130 48 106Z'],
      ['Plant the stem', 'Draw two lines from the underside. Widen the stem near the ground and round off the bottom.', 'Let one side of the stem curve farther than the other.', 'M104 117 Q106 140 94 163 Q118 181 142 161 Q132 137 133 116 M104 117 Q118 112 133 116'],
      ['Spot the cap', 'Draw scattered oval spots. Make them narrower near the top edge.', 'Leave open space between your spots.', 'M97 56 C104 51 115 52 118 57 C116 63 101 64 97 59Z M132 68 C140 62 154 66 156 73 C150 80 135 78 132 71Z M69 83 C71 76 82 73 88 77 C90 82 79 88 71 88Z M108 75 C110 68 123 67 128 74 C128 79 116 83 108 78Z M163 89 Q168 83 178 94 Q171 96 163 89Z'],
      ['Shade and add grass', 'Use thin strokes that fan out under the cap. Draw tufts of grass next to the stem.', 'Follow the stem’s curve when you shade it.', 'M105 115 L78 107 M113 114 L91 101 M120 113 L108 98 M127 113 L128 98 M133 115 L147 100 M139 117 L168 105 M141 120 L175 111', 'M131 128 Q129 147 137 159 M126 141 Q128 154 132 161 M91 174 Q91 165 84 160 M88 174 Q83 168 77 168 M151 172 Q151 162 159 157 M156 172 Q160 166 167 166'],
    ],
  },
  {
    id: 'sleepy-cat', title: 'Sleepy cat', category: 'Animals', minutes: 6, skill: 'Curves',
    steps: [
      ['Make the head', 'Draw a bean shape for the head, with one cheek a bit wider.', 'Let the bottom edge be nearly flat where the cat is lying down.', 'M52 102 C51 78 69 66 97 67 C123 70 136 90 129 107 C119 130 54 129 52 102Z'],
      ['Add the ears', 'Draw two peaked ears along the top. Put a smaller angle inside each.', 'Angle the ears away from the middle.', 'M56 85 Q49 65 54 49 Q71 55 83 68 M103 69 Q114 53 131 51 Q134 70 124 87 M58 58 L71 71 M124 60 L115 72'],
      ['Curl up the body', 'Start behind the head and make a big rounded back. Bring the line back underneath the cat.', 'Make the body wider than the head.', 'M126 86 C159 67 192 90 197 122 C201 145 179 157 147 156 L80 156 Q58 155 60 141 Q62 130 81 125'],
      ['Tuck in the tail', 'Curl a ribbon shape from the back toward the little front paw.', 'Keep a finger-width between the two curves.', 'M195 129 C184 150 159 157 129 152 C114 150 115 138 127 139 Q152 145 166 133'],
      ['Give it sleepy eyes', 'Draw two arcs for closed eyes, a tiny nose, whiskers and a few back stripes.', 'Use a lighter touch for the whiskers.', 'M66 97 Q73 104 81 98 M104 98 Q112 105 119 98 M88 105 Q93 102 98 105 L93 109Z M93 109 L93 113 Q88 116 85 113 M93 113 Q98 116 102 112', 'M57 108 L43 106 M57 113 L44 117 M122 107 L136 103 M122 112 L138 115 M142 82 Q150 88 152 96 M155 81 Q162 87 165 96 M169 86 Q176 92 178 102 M71 145 L70 151 M80 145 L79 153'],
    ],
  },
  {
    id: 'swirl-cone', title: 'Ice cream cone', category: 'Food', minutes: 6, skill: 'Repeating lines',
    steps: [
      ['Draw a cone', 'Draw a long upside-down triangle with a rounded tip.', 'Picture the point directly below the center of the top edge.', 'M79 106 Q120 114 161 106 L124 182 Q120 190 116 181Z'],
      ['Scoop the ice cream', 'Draw a dome over the cone. Use small bumps across the bottom where it meets the rim.', 'Connect the two ends of the scoop to the cone.', 'M79 106 Q64 105 65 94 Q65 83 79 80 C78 56 98 39 120 39 C143 38 162 56 163 80 Q176 85 176 96 Q175 110 161 106 Q149 113 136 108 Q123 117 110 110 Q91 115 79 106Z'],
      ['Cross the waffle lines', 'Draw slanted lines on the cone. Cross them with a second set to make a diamond pattern.', 'Begin with widely spaced lines so you have room for every diamond.', 'M85 119 L137 152 M94 136 L129 169 M107 156 L123 179 M99 110 L144 139 M121 111 L151 125', 'M155 116 L103 151 M147 132 L112 167 M140 146 L118 176 M142 110 L96 138 M122 111 L89 125'],
      ['Put a cherry on top', 'Perch a tiny round cherry at the top. Add a curved stem and a dash for the shine.', 'Let the cherry sit slightly off center.', 'M113 40 C110 29 121 25 126 28 C134 22 142 37 132 41 M126 29 Q126 17 137 15 M117 33 l4-2'],
      ['Finish the scoop', 'Add small sprinkle dashes and a few light strokes under the right edge of the scoop.', 'Mix up the angles of the sprinkles.', 'M92 71 l7-4 M107 55 l3 7 M120 72 l6 4 M136 56 l7 3 M145 76 l-5 6 M100 87 l4 6 M124 94 l6-5', 'M157 82 l-6 8 M160 85 l-7 10 M165 89 l-8 10 M169 95 l-6 7'],
    ],
  },
  {
    id: 'bow-dress', title: 'Bow dress', category: 'Fashion', minutes: 8, skill: 'Symmetry & folds',
    steps: [
      ['Draw the bodice', 'Make two shoulder straps and a scoop neck. Bring the sides in toward the waist.', 'Imagine a line through the middle to help you balance the two sides.', 'M94 34 L104 32 Q119 50 136 32 L145 34 Q144 53 151 64 L140 91 Q120 95 100 91 L89 64 Q96 52 94 34Z'],
      ['Sweep out the skirt', 'From both ends of the waist, draw long curves out and down. Join them with a wavy hem.', 'Start narrow at the waist and let the fabric flare out.', 'M100 91 Q82 130 54 166 Q69 176 89 173 Q104 185 121 178 Q143 185 159 174 Q177 177 186 165 Q156 128 140 91'],
      ['Tie the bow', 'Draw a small knot at the waist. Add a loop on each side and two ribbons below.', 'Make the bow wide enough to overlap the waistline.', 'M116 91 Q120 88 124 91 L125 98 Q120 101 115 98Z M116 92 Q101 78 98 84 Q94 103 106 101 L115 97 M124 92 Q140 78 143 84 Q148 103 133 101 L125 97', 'M116 99 Q113 116 102 123 L114 120 L117 126 Q122 112 121 101 M124 99 Q128 114 139 120 L130 119 L127 125 Q123 112 122 101'],
      ['Sketch the folds', 'Start a few light lines under the bow and pull them toward the hem. Curve each line gently.', 'Let some folds end early so they look soft.', 'M100 116 Q86 151 79 166 M109 125 Q105 154 96 170 M122 130 Q121 154 123 173 M135 127 Q143 154 150 169 M148 115 Q159 144 169 163'],
      ['Shade the fabric', 'Darken one side of each fold near the hem. Add dotted stitching to the neckline.', 'Blend the dark marks into the white space by easing off your pencil.', 'M81 159 l-6 7 M86 154 l-7 10 M98 161 l-5 9 M101 155 l-6 13 M151 158 l5 11 M148 154 l5 12 M167 153 l8 11 M164 148 l7 12', 'M104 38 l3 3 m3 2 l3 2 m4 1 l4 0 m4-1 l3-2 m3-2 l3-3'],
    ],
  },
  {
    id: 'bunny', title: 'Meadow bunny', category: 'Animals', minutes: 7, skill: 'Overlapping shapes',
    steps: [
      ['Find the cheeks', 'Draw a rounded head that widens at the cheeks and narrows a little at the top.', 'Keep the chin low and round.', 'M77 93 C77 73 95 60 119 60 C142 60 163 73 163 96 C162 120 79 126 77 93Z'],
      ['Lift the ears', 'Draw two long ears rising from the top. Bend one ear a little to the side.', 'Leave a clear space between the ears.', 'M96 63 C79 42 75 14 86 12 C97 10 109 34 112 60 M126 60 C132 31 145 14 154 20 C166 28 155 51 143 65', 'M91 25 Q89 38 102 59 M151 29 Q154 39 136 61'],
      ['Shape the body', 'Sweep two round curves down from the cheeks. Leave room to put paws across the bottom.', 'The cheeks sit in front of the shoulders.', 'M95 113 Q72 133 83 158 M144 113 Q166 133 158 158 M102 171 Q122 178 142 171'],
      ['Add paws and a tail', 'Make two little ovals at the base. Add a bumpy tail peeking around one side.', 'Let the paws overlap the body line.', 'M102 153 C84 149 71 166 80 173 Q91 180 106 174 Q111 161 102 153Z M139 154 C153 150 169 165 161 173 Q149 179 135 174 Q130 163 139 154Z M160 149 Q163 139 172 141 Q181 136 187 145 Q197 157 183 165 Q176 170 165 166'],
      ['Draw the expression', 'Add bright eyes, a tiny nose and a split smile. Add a few short fur marks.', 'Leave a tiny gap inside each eye for shine.', 'M98 87 a4 6 0 1 0 0 12 a4 6 0 1 0 0-12 M142 87 a4 6 0 1 0 0 12 a4 6 0 1 0 0-12 M115 100 Q120 98 125 100 L120 105Z M120 105 L120 110 Q115 114 110 110 M120 110 Q125 114 130 110', 'M88 104 l6 1 M85 109 l7 0 M149 105 l7-1 M150 110 l7 0 M87 164 l-2 5 M94 165 l-2 6 M146 165 l2 6 M153 164 l2 5 M114 139 l3 6 M121 141 l2 6 M128 139 l-1 6'],
    ],
  },
  {
    id: 'avocado', title: 'Avocado half', category: 'Food', minutes: 5, skill: 'Soft shading',
    steps: [
      ['Draw a pear shape', 'Draw a narrow rounded top that widens into a big round base.', 'Keep the shoulders soft so the change in width feels smooth.', 'M119 34 C100 34 97 56 89 72 C77 96 59 114 61 141 C63 173 95 183 121 182 C154 181 180 168 180 140 C180 115 162 93 151 72 C142 55 140 34 119 34Z'],
      ['Follow the peel', 'Draw a second outline just inside the first to show the edge of the skin.', 'Keep the space between outlines thin and even.', 'M119 42 C104 42 103 61 96 76 C84 99 67 117 69 140 C71 164 95 175 121 174 C147 174 172 162 172 140 C172 117 155 96 144 76 C136 61 135 42 119 42Z'],
      ['Set in the pit', 'Draw a round seed in the lower half. Leave a small ring around it for the hollow.', 'Leave a little more room below the seed on the left.', 'M120 104 C104 103 91 116 92 134 C94 151 105 161 120 160 C140 160 151 149 151 132 C151 115 139 103 120 104Z', 'M87 130 Q84 161 117 166 Q145 169 158 145'],
      ['Give the pit a highlight', 'Draw a small curved crescent high on the left side of the pit. Leave its inside white.', 'Imagine the light coming from the upper left.', 'M100 130 Q103 114 118 111 Q108 116 105 127 Q104 133 100 130Z'],
      ['Shade the peel and seed', 'Use small strokes near the right edge of the pit and along the bottom of the peel.', 'Press a little harder at the edge, then lighten toward the center.', 'M144 120 Q147 138 136 149 M147 126 Q149 144 137 153 M142 124 Q143 138 132 147 M138 132 Q137 140 129 147 M76 151 l-4 5 M80 157 l-4 5 M85 162 l-3 6 M92 166 l-3 7 M101 169 l-2 7 M110 172 l0 6 M124 173 l0 6 M135 171 l2 6 M145 169 l3 5 M155 164 l4 5 M164 157 l5 4'],
    ],
  },
  {
    id: 'sunflower', title: 'Sunflower', category: 'Nature', minutes: 7, skill: 'Radial shapes',
    steps: [
      ['Draw the center', 'Put a round center above the middle of your page. Make it a little wider than it is tall.', 'Start lightly so you can smooth the circle.', 'M118 58 C138 58 151 69 151 84 C151 101 136 113 118 113 C99 112 86 101 86 84 C86 69 99 58 118 58Z'],
      ['Stretch out the petals', 'Add long, pointed petals around the center. Aim each tip away from the middle.', 'Space eight petals around the center before filling any gaps.', 'M105 61 Q94 39 106 21 Q121 40 119 58 M127 59 Q130 33 149 24 Q151 43 139 64 M147 70 Q164 50 184 55 Q177 75 151 80 M151 88 Q177 84 192 103 Q170 113 144 101 M139 107 Q161 119 160 140 Q137 138 127 112 M117 113 Q116 139 102 148 Q92 130 104 111 M96 106 Q77 127 55 120 Q66 101 89 96 M86 88 Q57 89 48 72 Q68 63 89 74 M92 67 Q69 53 73 33 Q90 36 102 59'],
      ['Plant a stem', 'Draw two long lines from behind the flower toward the bottom edge.', 'Bend the lines together so the stem stays narrow.', 'M119 114 Q121 146 112 190 M126 114 Q128 147 119 190 L112 190'],
      ['Add two leaves', 'Draw pointed leaves on opposite sides of the stem. Pull a line down the middle of each.', 'Use a longer curve on one side of a leaf to make it look lively.', 'M119 164 Q98 135 65 143 Q77 168 118 169 M119 168 Q92 154 73 147 M125 151 Q144 127 179 130 Q166 151 124 158 M125 155 Q151 141 171 133'],
      ['Texture the center', 'Add short crisscrossing marks to the disk and a light crease in each petal.', 'Give the disk denser marks near the bottom.', 'M96 78 l12-11 M97 91 l23-23 M103 100 l32-30 M112 105 l31-29 M124 104 l20-17 M95 79 l25 26 M103 71 l29 30 M114 66 l27 25 M126 66 l18 16', 'M108 34 l4 19 M144 36 l-9 19 M172 62 l-19 12 M181 100 l-27-6 M154 132 l-18-19 M103 136 l8-19 M66 116 l24-13 M57 73 l24 8 M79 42 l15 17'],
    ],
  },
  {
    id: 'camp-mug', title: 'Camp mug', category: 'Things', minutes: 6, skill: 'Ellipses & volume',
    steps: [
      ['Make the opening', 'Draw a wide, flat oval for the top of the mug.', 'Keep both sides of the oval rounded.', 'M63 71 C63 48 168 47 171 70 C174 94 63 95 63 71Z'],
      ['Build the sides', 'Drop two nearly straight lines from the oval. Join them with a shallow curve.', 'Match the roundness of the base to the opening.', 'M63 71 L70 151 C72 170 161 171 164 152 L171 70'],
      ['Hook on a handle', 'Draw a sideways C starting at the right edge. Add a smaller C inside it.', 'Make the gap wide enough for two imaginary fingers.', 'M169 92 C204 82 212 133 165 143 M168 104 C190 96 197 123 166 132'],
      ['Add rim and steam', 'Draw a second oval inside the rim. Then float two wavy lines up from the mug.', 'Keep the steam lighter than the mug outline.', 'M69 71 C70 54 162 54 165 70 C168 87 69 88 69 71Z M109 59 C127 49 97 41 113 30 C122 24 125 19 119 14 M131 55 C144 44 124 40 136 31'],
      ['Decorate and shade', 'Draw a small mountain badge. Hatch along the base and the right edge.', 'Follow the curve of the mug with your shadow marks.', 'M92 129 L108 111 L116 119 L124 106 L143 129Z M104 116 l4 3 l4-3 M120 112 l5 4 l4-3', 'M153 110 Q154 131 151 147 M158 104 Q159 128 155 148 M149 146 l-8 10 M141 149 l-7 9 M132 151 l-6 8 M122 151 l-5 8 M112 151 l-5 7'],
    ],
  },
  {
    id: 'tiny-dragon', title: 'Tiny dragon', category: 'Fantasy', minutes: 9, skill: 'Curves & overlap',
    steps: [
      ['Make the head', 'Draw a round forehead and a snout that sticks out to the left. Bring the jaw back under the head.', 'Give the dragon a big, soft cheek.', 'M67 73 C67 48 98 38 119 52 C137 65 137 100 116 112 C99 121 68 107 56 96 C45 86 52 75 67 73Z'],
      ['Draw horns and an eye', 'Add two small horns above the head. Put a bright oval eye, a nostril and a smile on the face.', 'Leave a tiny highlight near the top of the eye.', 'M79 50 Q76 35 87 24 Q88 40 98 45 M104 46 Q113 32 124 31 Q118 44 119 52', 'M88 73 C89 64 104 65 105 78 C106 90 91 94 88 82Z M94 78 a4 5 0 1 0 0.1 0 M63 83 l4 0 M57 94 Q71 102 83 94'],
      ['Sit it down', 'Curve the belly down from the jaw. Put two paws on the ground and round out the back.', 'Use a nearly flat curve for the spot where it sits.', 'M94 113 Q78 133 80 153 Q64 162 75 172 Q85 179 106 171 Q124 180 151 169 Q167 156 159 136 Q152 110 124 105 M106 171 Q113 164 108 157 Q107 142 116 131'],
      ['Unfold the wing', 'Pull a triangle up and out from the back. Scallop the far edge and draw two ribs.', 'Let the wing spread behind the dragon.', 'M146 121 Q147 84 191 66 Q184 85 191 98 Q175 94 178 110 Q162 104 160 128 M148 120 Q156 95 191 66 M152 123 Q167 101 178 110'],
      ['Curl a tail and add scales', 'Curl a little tail up from the body. Add belly stripes and tiny V-shaped scales.', 'Give the tail a tapered end by bringing the curves together.', 'M158 148 Q183 157 193 128 Q208 142 194 158 Q180 175 148 170', 'M84 132 Q96 138 107 135 M81 141 Q93 148 105 144 M81 151 Q93 156 105 152 M132 134 l4 4 l4-4 M140 146 l4 4 l4-4 M126 154 l4 4 l4-4 M82 166 l-1 6 M91 165 l-1 7'],
    ],
  },
  {
    id: 'pond-turtle', title: 'Pond turtle', category: 'Animals', minutes: 7, skill: 'Patterns & arcs',
    steps: [
      ['Draw a shell', 'Make a low dome and connect the two ends with a shallow curve.', 'Try a long, smooth sweep for the top.', 'M47 127 C60 94 81 70 118 70 C154 70 176 95 186 127 Q123 151 47 127Z'],
      ['Peek out a head', 'Extend a neck from the left. Round it into a small head and curl the line back into the shell.', 'Keep the head lower than the shell.', 'M57 111 Q48 104 44 91 C35 69 10 76 13 96 Q14 112 31 112 Q41 112 48 128'],
      ['Find its feet', 'Hang three feet below the shell, then add a pointed tail behind it.', 'Draw the front feet a little wider than the back foot.', 'M61 131 Q53 152 60 159 L80 159 Q87 154 87 136 M99 138 Q99 158 109 161 L123 160 Q127 157 126 140 M151 137 Q153 157 164 157 L175 155 Q180 149 174 132 M186 126 Q202 126 210 116 Q209 133 187 136'],
      ['Divide up the shell', 'Draw a little hexagon near the center. Extend its corners to the outside to divide the shell into panels.', 'Give every panel space for shading.', 'M105 90 L129 89 L142 107 L131 125 L106 124 L93 107Z M105 90 L99 73 M129 89 L136 73 M142 107 L172 105 M131 125 L138 138 M106 124 L98 137 M93 107 L64 101'],
      ['Give it character', 'Add a tiny eye, smile, toe marks and a few short shadows inside the panels.', 'Use lighter marks for the patterned shell than for the eye.', 'M26 88 a3 4 0 1 0 0.1 0 M15 100 Q26 109 34 102 M64 153 l0 5 M70 153 l0 5 M114 155 l0 5 M165 151 l1 5', 'M113 117 l8-7 M121 119 l10-10 M146 119 l7-7 M150 125 l11-11 M155 128 l13-14 M79 123 l8-9 M83 129 l9-11 M140 83 l8 7 M141 88 l13 11'],
    ],
  },
  {
    id: 'camera', title: 'Pocket camera', category: 'Things', minutes: 7, skill: 'Rounded shapes',
    steps: [
      ['Draw the camera body', 'Draw a low rectangle and round off each corner. Raise a small bump at the top.', 'Keep the bottom and top edges level.', 'M44 69 L86 69 L96 52 L139 52 L151 69 L193 69 Q205 69 205 82 L205 145 Q205 157 192 157 L45 157 Q33 157 33 144 L33 82 Q33 69 44 69Z'],
      ['Frame the lens', 'Draw a big circle in the middle, followed by a slightly smaller circle inside it.', 'Leave a band between the circles for the lens rim.', 'M119 78 a35 35 0 1 0 0.1 0Z M119 85 a28 28 0 1 0 0.1 0Z'],
      ['Add the controls', 'Draw a small button on top and a little window on the front.', 'Round the corners of the window the way you rounded the body.', 'M52 69 L52 61 Q53 58 58 58 L71 58 Q77 58 77 61 L77 69 M169 83 L188 83 Q192 83 192 87 L192 97 Q192 101 188 101 L169 101 Q165 101 165 97 L165 87 Q165 83 169 83Z'],
      ['Catch the light', 'Draw another ring inside the lens. Leave a crescent and a small dot for reflections.', 'Place the bright marks near the same side of the lens.', 'M119 94 a19 19 0 1 0 0.1 0Z M106 112 Q107 102 118 100 Q114 104 113 108 Q111 114 106 112Z M123 102 a2 2 0 1 0 0.1 0Z'],
      ['Finish the grip', 'Draw a strip down one side and fill it with short pencil texture.', 'Use the same direction for each stripe.', 'M47 82 Q62 80 68 86 L68 140 Q60 146 47 144Z M50 91 l10-7 M50 100 l15-10 M50 109 l15-10 M50 118 l15-10 M50 127 l15-10 M50 136 l15-10 M54 141 l11-7', 'M170 147 l7-5 M177 148 l8-6 M185 148 l8-7'],
    ],
  },
  {
    id: 'cozy-beanie', title: 'Cozy beanie', category: 'Fashion', minutes: 6, skill: 'Repeating texture',
    steps: [
      ['Curve the crown', 'Draw a half-circle, slightly taller than it is wide. Leave the bottom open.', 'Give the top a soft, round curve.', 'M61 136 C56 99 76 56 117 55 C157 54 180 94 178 136'],
      ['Fold up the cuff', 'Draw a wide, slightly curved band across the bottom of the hat.', 'Follow the same curve on both edges of the fold.', 'M59 130 Q117 142 179 130 Q187 138 179 157 Q118 173 60 157 Q53 144 59 130Z'],
      ['Add a pom-pom', 'Draw a bumpy circle on top, with a few tiny curves inside.', 'Change the size of the bumps to suggest soft yarn.', 'M103 57 Q95 53 99 47 Q91 41 98 34 Q97 27 105 25 Q108 16 117 20 Q125 15 129 23 Q139 23 139 31 Q147 37 140 43 Q144 51 135 54 Q134 59 130 57', 'M106 34 q5-8 11-6 M129 30 q8 5 4 11 M107 43 q-4 7 4 10 M117 45 q6 5 11-1'],
      ['Draw knit ribs', 'Pull long curved lines from the crown to the cuff. Add short ribs inside the cuff.', 'Let the lines fan out from the top.', 'M111 57 Q78 86 77 133 M115 57 Q95 90 97 136 M120 58 Q120 93 118 138 M126 58 Q145 92 141 137 M132 58 Q163 86 162 133', 'M68 134 l0 24 M80 136 l0 25 M93 138 l0 25 M107 140 l0 24 M122 141 l0 23 M137 140 l0 23 M152 139 l0 22 M166 136 l0 22'],
      ['Add texture and shadow', 'Mark a few V-shaped stitches between the ribs. Darken the bottom edge with light hatching.', 'Leave wide gaps so the knit stays easy to read.', 'M98 82 l2 4 l4-3 M94 96 l2 4 l4-3 M88 110 l2 4 l4-3 M107 102 l3 4 l4-4 M106 117 l3 4 l4-4 M126 101 l4 4 l3-4 M127 116 l4 4 l3-4 M150 103 l4 4 l2-4 M153 117 l4 4 l2-4', 'M74 151 l4 7 M86 154 l4 7 M101 156 l4 7 M113 157 l4 7 M129 157 l4 7 M144 155 l4 7 M158 152 l4 7'],
    ],
  },
  {
    id: 'moon-moth', title: 'Moon moth', category: 'Nature', minutes: 8, skill: 'Symmetry',
    steps: [
      ['Draw the moth’s body', 'Make a tiny head, a plump middle and a long tapered shape beneath it.', 'Keep all three shapes lined up through the middle.', 'M112 58 Q111 47 120 47 Q129 47 128 58 M120 56 C102 55 102 83 120 85 C138 84 138 55 120 56Z M111 82 Q108 104 120 126 Q132 105 129 82'],
      ['Spread the top wings', 'Pull broad curves from the middle toward two pointed tips. Bring the wings back in toward the body.', 'Compare the heights of the tips before you close the wings.', 'M109 66 C81 44 62 41 27 46 Q33 79 61 98 Q87 112 110 87 M131 66 C159 44 178 41 213 46 Q207 79 179 98 Q153 112 130 87'],
      ['Drop the tail wings', 'Under each wing, make a round lobe that trails into a long thin tail.', 'Repeat the same shape on the other side.', 'M62 99 Q53 129 80 141 Q91 149 88 174 Q98 173 103 146 Q116 129 113 105 M178 99 Q187 129 160 141 Q149 149 152 174 Q142 173 137 146 Q124 129 127 105'],
      ['Design the markings', 'Draw a crescent on each top wing and a small circle on each lower wing.', 'Place each pair of markings at the same distance from the body.', 'M67 65 Q59 82 78 88 Q61 93 57 81 Q54 71 67 65Z M173 65 Q181 82 162 88 Q179 93 183 81 Q186 71 173 65Z M83 115 a7 7 0 1 0 0.1 0Z M157 115 a7 7 0 1 0 0.1 0Z'],
      ['Add antennae and shading', 'Sweep two antennae up from the head. Shade the wing edges with small, outward strokes.', 'Compare both wings as you add texture.', 'M116 48 Q108 30 94 27 M124 48 Q132 30 146 27 M109 36 l-7 0 M106 32 l-2-6 M131 36 l7 0 M134 32 l2-6', 'M37 54 l8 3 M40 63 l9 2 M45 73 l8 0 M52 82 l8-1 M203 54 l-8 3 M200 63 l-9 2 M195 73 l-8 0 M188 82 l-8-1 M68 116 l5-5 M70 125 l5-5 M74 132 l5-4 M172 116 l-5-5 M170 125 l-5-5 M166 132 l-5-4 M115 90 l10 0 M115 96 l10 0 M116 102 l8 0'],
    ],
  },
  {
    id: 'pizza-slice', title: 'Pizza slice', category: 'Food', minutes: 5, skill: 'Shapes & placement',
    steps: [
      ['Draw the slice', 'Draw two slanted lines that meet at the bottom. Join the top with a big arch.', 'Put the tip slightly off center for a tilted slice.', 'M53 66 Q118 28 186 55 L136 176 Q133 182 129 176Z'],
      ['Give it a crust', 'Draw a second arch that follows the top. Round the two ends where it meets the sides.', 'Leave enough room to shade between the two arches.', 'M60 77 Q121 44 181 66'],
      ['Drip the cheese', 'Add a loose wavy line just inside an edge. Let a little loop of cheese stretch down.', 'Use a long narrow curve for the drop.', 'M63 82 Q82 106 88 104 Q91 104 97 115 Q105 130 109 127 Q112 126 115 138 L122 153 Q127 165 130 153 Q131 145 137 147 Q145 149 151 135 L177 72'],
      ['Scatter the toppings', 'Draw three pepperoni circles and a few bits of herbs and peppers.', 'Vary the sizes and leave breathing room between them.', 'M100 75 a10 10 0 1 0 0.1 0Z M151 73 a12 12 0 1 0 0.1 0Z M128 109 a11 11 0 1 0 0.1 0Z M113 97 l4 2 l3-5 M141 99 q5-7 10-3 M98 99 l-5-2 M139 128 l4-3 M127 79 l4 2 M118 136 l4-2'],
      ['Toast the crust', 'Add broken slanted marks along the top edge and tiny specks to the pepperoni.', 'For a toasted effect, group some marks close together.', 'M67 63 l7 4 M76 60 l7 4 M88 55 l8 4 M114 48 l7 5 M124 47 l8 6 M150 48 l7 6 M159 48 l8 7 M173 52 l5 6', 'M96 79 l1 1 M102 82 l1 1 M147 80 l1 1 M154 77 l1 1 M151 84 l1 1 M125 114 l1 1 M132 117 l1 1'],
    ],
  },
  {
    id: 'cloud-ship', title: 'Cloud ship', category: 'Fantasy', minutes: 8, skill: 'Balance & perspective',
    steps: [
      ['Draw the hull', 'Draw a long curve like a smile. Place a shallower curve below it and connect the ends.', 'Lift the front of the boat a little higher than the back.', 'M42 120 Q124 146 195 113 Q186 146 157 160 Q102 177 59 148Z'],
      ['Raise the mast', 'Draw two close vertical lines from the deck. Put a small flag at the top.', 'Keep the mast upright while the hull curves under it.', 'M118 134 L118 34 L123 34 L123 134 M123 35 Q136 29 152 40 L143 45 L150 53 Q136 48 123 52'],
      ['Catch the wind', 'Draw a big curved sail on one side of the mast and a smaller one on the other.', 'Curve the bottom edge as if the wind is puffing the sail out.', 'M118 49 C91 60 76 83 69 117 Q93 105 118 124 M123 62 Q161 72 175 114 Q150 112 123 125'],
      ['Float some clouds', 'Draw low, flat cloud shapes with soft round bumps. Place one below the ship and one behind the flag.', 'Use different sized bumps for each cloud.', 'M31 177 Q22 177 24 168 Q27 161 37 164 Q44 150 58 161 Q74 154 83 166 Q96 163 99 174 Q100 181 91 182 L33 182Z M175 77 Q168 76 171 69 Q174 65 180 66 Q188 55 197 66 Q209 63 210 74 Q216 76 211 81 L177 81Z'],
      ['Add planks and rigging', 'Follow the hull with parallel lines. Draw a small round window and a rope from mast to bow.', 'Bend the plank lines the same way as the hull.', 'M53 136 Q127 161 189 126 M60 147 Q123 172 177 141 M152 143 a4 4 0 1 0 0.1 0Z M124 51 L194 113', 'M77 163 l6 4 M86 167 l6 3 M155 155 l6-4 M164 151 l7-5 M167 141 l6-7 M162 111 Q151 105 141 108'],
    ],
  },
  {
    id: 'roller-skate', title: 'Roller skate', category: 'Things', minutes: 8, skill: 'Proportion',
    steps: [
      ['Outline the boot', 'Start at the heel on the left, rise up to the ankle, then slope down to a rounded toe on the right.', 'Keep the bottom of the boot nearly level.', 'M52 113 Q48 79 58 44 L99 44 Q100 74 131 91 Q146 101 169 101 Q190 104 184 122 Q132 137 52 125Z'],
      ['Build the sole', 'Add a thin band below the boot. Put two short blocks below it to hold the wheels.', 'The band should follow the bottom curve of the boot.', 'M52 125 L54 138 Q132 150 181 135 L184 122 M66 140 l3 13 l15 0 l4-11 M146 141 l4 13 l15 0 l4-16'],
      ['Roll in the wheels', 'Draw two circles under the blocks and smaller circles inside for the hubs.', 'Make the wheels touch the same imaginary ground line.', 'M76 150 a16 16 0 1 0 0.1 0Z M157 150 a16 16 0 1 0 0.1 0Z M76 160 a6 6 0 1 0 0.1 0Z M157 160 a6 6 0 1 0 0.1 0Z M176 138 l9 8 l-3 8 l-9-3 l-2-11'],
      ['Lace up the boot', 'Add four short slanted laces along the slope. Draw a tall curve above the heel for a seam.', 'Follow the slope when you space the laces.', 'M92 58 l13 1 M96 68 l14 0 M101 77 l16-1 M108 87 l17-3 M62 56 Q79 86 70 126 M156 102 Q147 115 149 129'],
      ['Add a star and shade', 'Draw a little star on the ankle. Shade the heel and make a few small shine marks on the wheels.', 'Keep the upper edges of the wheels light.', 'M99 88 L102 96 L111 96 L104 102 L107 110 L99 105 L92 110 L94 101 L88 96 L96 96Z M56 103 l10 9 M56 110 l9 9 M57 118 l6 5 M67 167 Q68 175 76 176 M148 167 Q149 175 157 176'],
    ],
  },
  {
    id: 'little-owl', title: 'Little owl', category: 'Animals', minutes: 7, skill: 'Circles & texture',
    steps: [
      ['Draw a soft oval', 'Sketch a tall round body, a little wider near the head.', 'Flatten the bottom slightly so it can perch.', 'M119 39 C154 39 173 66 170 106 C167 146 154 166 119 167 C83 167 71 145 68 106 C65 69 84 39 119 39Z'],
      ['Set the face', 'Draw two large circles side by side. Set a small triangle between them for the beak.', 'Leave a little gap between the two eye circles.', 'M97 61 a20 20 0 1 0 0.1 0Z M142 61 a20 20 0 1 0 0.1 0Z M114 95 Q119 91 125 95 L119 104Z'],
      ['Draw the wings', 'Curve one wing in from each side. Tuck the ends back against the belly.', 'Turn the tips of both wings toward the middle.', 'M69 100 Q91 107 95 148 Q77 143 73 124 M170 100 Q148 107 144 148 Q162 143 166 124'],
      ['Find a perch', 'Draw a branch below the owl. Add two pairs of curved toes gripping it.', 'Leave small gaps in the branch line where the toes overlap.', 'M47 175 Q75 173 100 172 M113 172 Q121 171 127 171 M141 170 L192 165 Q194 170 190 174 Q115 188 49 183Z M102 163 Q99 168 100 176 Q103 181 106 175 L107 166 M109 165 Q107 171 108 176 Q111 180 114 174 L115 166 M129 165 Q126 170 127 175 Q130 179 133 174 L134 164 M136 164 Q134 170 135 175 Q138 179 141 173 L142 163'],
      ['Finish the feathers', 'Fill in two dark pupils, leaving small highlights. Put short U shapes down the belly.', 'Stagger the U shapes like roof tiles.', 'M97 72 a8 9 0 1 0 0.1 0Z M142 72 a8 9 0 1 0 0.1 0Z M94 75 a2 2 0 1 0 0.1 0Z M139 75 a2 2 0 1 0 0.1 0Z', 'M102 115 q4 7 8 0 M117 115 q4 7 8 0 M132 115 q4 7 8 0 M109 128 q4 7 8 0 M125 128 q4 7 8 0 M101 140 q4 7 8 0 M117 140 q4 7 8 0 M133 140 q4 7 8 0 M109 152 q4 7 8 0 M125 152 q4 7 8 0'],
    ],
  },
];
