'use strict';

// One drawing renderer keeps the lesson, replay and tracing guide aligned.
const drawExample = (() => {
  const artWidth = 240;
  const artHeight = 210;
  const pathsByLesson = new WeakMap();
  const svgNamespace = 'http://www.w3.org/2000/svg';

  // Transparent color washes for the finished examples in the lesson library.
  const washes = {
    'little-fox': [
      ['#c97143', 'M55 73 Q67 56 87 55 L59 68 Q54 44 54 21 Q76 28 88 54 Q109 50 136 55 Q151 31 173 23 Q175 49 161 70 L166 76 Q139 83 111 112 Q83 84 55 73Z'],
      ['#c97143', 'M133 113 Q151 114 164 135 C183 130 184 104 214 98 Q215 116 210 125 Q195 119 190 113 C193 136 176 159 152 174 L123 171 Q129 158 128 135Z'],
      ['#f4e7d3', 'M57 75 Q81 79 110 111 Q137 84 164 78 Q148 104 111 118 Q79 108 57 75Z'],
    ],
    strawberry: [
      ['#db7779', 'M65 76 Q83 52 117 66 Q158 50 177 76 C192 104 145 177 120 178 C96 177 49 105 65 76Z'],
      ['#749260', 'M117 62 Q113 53 117 38 L124 36 Q120 50 128 62 Q141 60 163 57 Q155 73 137 73 Q145 79 150 95 Q137 93 122 75 Q111 88 96 91 Q100 80 107 76 Q90 74 78 56 Q103 63 117 62Z'],
    ],
    'high-top': [
      ['#a38ab5', 'M42 131 Q45 109 67 106 L93 98 Q117 86 128 51 Q154 55 176 50 Q191 84 188 124 Q153 138 42 131Z'],
      ['#f6ebd9', 'M36 132 Q146 141 188 124 L190 145 Q148 162 72 156 Q43 156 36 147Z'],
    ],
    mushroom: [
      ['#c68165', 'M48 106 C55 70 79 43 112 40 C150 34 180 62 192 106 C151 87 83 83 48 106Z'],
      ['#b6a080', 'M104 118 Q119 113 132 117 Q133 142 142 161 Q118 181 94 163 Q106 140 104 118Z'],
      ['#f7ecda', 'M97 56 Q108 49 118 57 Q116 63 98 61Z M132 68 Q146 61 156 73 Q149 81 132 72Z M69 83 Q76 73 88 77 Q89 83 71 88Z M108 75 Q116 66 128 74 Q126 83 108 78Z'],
    ],
    'sleepy-cat': [
      ['#c39566', 'M52 102 Q51 94 56 85 Q49 66 54 49 Q73 56 83 68 Q94 65 103 69 Q114 53 131 51 Q134 68 125 86 C160 67 192 90 197 122 C202 147 178 156 148 156 L80 156 Q57 155 60 142 Q61 131 81 125 Q53 121 52 102Z'],
    ],
    'swirl-cone': [
      ['#ce9a58', 'M79 106 Q120 114 161 106 L124 182 Q120 190 116 181Z'],
      ['#dda3b5', 'M79 106 Q64 105 65 94 Q65 83 79 80 C78 56 98 39 120 39 C143 38 162 56 163 80 Q176 85 176 96 Q175 110 161 106 Q149 113 136 108 Q123 117 110 110 Q91 115 79 106Z'],
      ['#c4727b', 'M113 40 C110 29 121 25 126 28 C134 22 142 37 132 41Z'],
    ],
    'bow-dress': [
      ['#ac89b9', 'M94 34 L104 32 Q119 50 136 32 L145 34 Q144 53 151 64 L140 91 Q156 128 186 165 Q177 177 159 174 Q143 185 121 178 Q104 185 89 173 Q69 176 54 166 Q82 130 100 91 L89 64 Q96 52 94 34Z'],
      ['#cf87a4', 'M116 92 Q101 78 98 84 Q94 103 106 101 L115 97 Q120 103 125 97 L133 101 Q148 103 143 84 Q140 78 124 92 Q120 88 116 92Z'],
    ],
    bunny: [
      ['#e1acac', 'M88 19 Q97 24 104 58 L96 62 Q83 41 88 19Z M152 23 Q157 42 139 64 L132 60 Q141 32 152 23Z'],
      ['#d9bca7', 'M88 123 Q110 128 145 116 Q165 136 156 154 Q175 154 162 173 Q150 180 135 174 Q120 177 105 174 Q91 180 80 173 Q71 165 82 158 Q77 137 88 123Z'],
    ],
    avocado: [
      ['#719254', 'M119 34 C100 34 97 56 89 72 C77 96 59 114 61 141 C63 173 95 183 121 182 C154 181 180 168 180 140 C180 115 162 93 151 72 C142 55 140 34 119 34Z'],
      ['#d8dc90', 'M119 42 C104 42 103 61 96 76 C84 99 67 117 69 140 C71 164 95 175 121 174 C147 174 172 162 172 140 C172 117 155 96 144 76 C136 61 135 42 119 42Z'],
      ['#b4846e', 'M120 104 C104 103 91 116 92 134 C94 151 105 161 120 160 C140 160 151 149 151 132 C151 115 139 103 120 104Z'],
    ],
    sunflower: [
      ['#e0b24f', 'M107 22 Q119 39 119 59 Q130 34 149 24 Q151 50 139 65 Q164 50 184 55 Q176 74 151 82 Q177 84 192 103 Q171 113 142 103 Q159 121 160 140 Q137 138 127 112 Q117 137 102 148 Q92 130 104 111 Q76 127 55 120 Q68 101 89 96 Q57 89 48 72 Q68 63 89 74 Q74 51 73 33 Q88 36 102 59 Q97 39 107 22Z'],
      ['#a58560', 'M118 58 C138 58 151 69 151 84 C151 101 136 113 118 113 C99 112 86 101 86 84 C86 69 99 58 118 58Z'],
      ['#7e9864', 'M119 164 Q98 135 65 143 Q77 168 118 169Z M125 151 Q144 127 179 130 Q166 151 124 158Z'],
    ],
    'camp-mug': [
      ['#76a1a2', 'M63 71 C78 92 156 91 171 70 L164 152 C159 170 74 170 70 151Z'],
      ['#a28272', 'M69 71 C70 54 162 54 165 70 C168 87 69 88 69 71Z'],
    ],
    'tiny-dragon': [
      ['#8cb480', 'M67 73 C67 48 98 38 119 52 C137 65 137 100 116 112 C99 121 68 107 56 96 C45 86 52 75 67 73Z M94 113 Q119 120 124 105 Q150 108 159 136 Q169 158 151 169 Q124 180 106 171 Q83 178 76 173 Q63 162 80 153 Q78 133 94 113Z'],
      ['#c797aa', 'M146 121 Q147 84 191 66 Q184 85 191 98 Q175 94 178 110 Q162 104 160 128Z'],
    ],
    'pond-turtle': [
      ['#a9b075', 'M47 127 C60 94 81 70 118 70 C154 70 176 95 186 127 Q123 151 47 127Z'],
      ['#91af97', 'M57 111 Q48 104 44 91 C35 69 10 76 13 96 Q14 112 31 112 Q41 112 48 128Z'],
    ],
    camera: [
      ['#8aa7b3', 'M44 69 L86 69 L96 52 L139 52 L151 69 L193 69 Q205 69 205 82 L205 145 Q205 157 192 157 L45 157 Q33 157 33 144 L33 82 Q33 69 44 69Z'],
      ['#dbe1df', 'M119 78 a35 35 0 1 0 0.1 0Z'],
      ['#828da8', 'M119 94 a19 19 0 1 0 0.1 0Z'],
    ],
    'cozy-beanie': [
      ['#a08cb4', 'M61 136 C56 99 76 56 117 55 C157 54 180 94 178 136Z'],
      ['#c1a1c7', 'M59 130 Q117 142 179 130 Q187 138 179 157 Q118 173 60 157 Q53 144 59 130Z'],
      ['#c1a1c7', 'M103 57 Q95 53 99 47 Q91 41 98 34 Q97 27 105 25 Q108 16 117 20 Q125 15 129 23 Q139 23 139 31 Q147 37 140 43 Q144 51 135 54 Q134 59 130 57Z'],
    ],
    'moon-moth': [
      ['#91ad92', 'M109 66 C81 44 62 41 27 46 Q33 79 61 98 Q87 112 110 87Z M131 66 C159 44 178 41 213 46 Q207 79 179 98 Q153 112 130 87Z'],
      ['#adbc87', 'M62 99 Q53 129 80 141 Q91 149 88 174 Q98 173 103 146 Q116 129 113 105 L110 87 Q91 111 62 99Z M178 99 Q187 129 160 141 Q149 149 152 174 Q142 173 137 146 Q124 129 127 105 L130 87 Q149 111 178 99Z'],
    ],
    'pizza-slice': [
      ['#e2b763', 'M53 66 Q118 28 186 55 L136 176 Q133 182 129 176Z'],
      ['#c19568', 'M53 66 Q118 28 186 55 L181 66 Q121 44 60 77Z'],
      ['#d87875', 'M100 75 a10 10 0 1 0 0.1 0Z M151 73 a12 12 0 1 0 0.1 0Z M128 109 a11 11 0 1 0 0.1 0Z'],
    ],
    'cloud-ship': [
      ['#ad8e68', 'M42 120 Q124 146 195 113 Q186 146 157 160 Q102 177 59 148Z'],
      ['#d8ad80', 'M118 49 C91 60 76 83 69 117 Q93 105 118 124Z M123 62 Q161 72 175 114 Q150 112 123 125Z'],
      ['#9eb8c4', 'M31 177 Q22 177 24 168 Q27 161 37 164 Q44 150 58 161 Q74 154 83 166 Q96 163 99 174 Q100 181 91 182 L33 182Z M175 77 Q168 76 171 69 Q174 65 180 66 Q188 55 197 66 Q209 63 210 74 Q216 76 211 81 L177 81Z'],
    ],
    'roller-skate': [
      ['#be8fae', 'M52 113 Q48 79 58 44 L99 44 Q100 74 131 91 Q146 101 169 101 Q190 104 184 122 Q132 137 52 125Z'],
      ['#91afb4', 'M76 150 a16 16 0 1 0 0.1 0Z M157 150 a16 16 0 1 0 0.1 0Z'],
      ['#e9b768', 'M99 88 L102 96 L111 96 L104 102 L107 110 L99 105 L92 110 L94 101 L88 96 L96 96Z'],
    ],
    'little-owl': [
      ['#b59a73', 'M119 39 C154 39 173 66 170 106 C167 146 154 166 119 167 C83 167 71 145 68 106 C65 69 84 39 119 39Z'],
      ['#f2e0b8', 'M97 61 a20 20 0 1 0 0.1 0Z M142 61 a20 20 0 1 0 0.1 0Z'],
    ],
  };

  const foxScene = [
    ['#779777', 'M36 174 Q31 151 21 139 M34 165 Q26 167 20 159 Q29 155 34 165Z M30 155 Q30 146 34 144 Q39 152 30 155Z M25 148 Q15 149 13 143 Q23 140 25 148Z'],
    ['#779777', 'M205 173 Q213 154 229 147 M210 164 Q214 156 207 153 Q203 161 210 164Z M217 156 Q216 145 224 141 Q224 150 217 156Z M220 155 Q230 153 235 157 Q227 161 220 155Z'],
    ['#c18756', 'M191 49 l0 13 m-6-6 l12 0 M42 98 l0 9 m-4-4 l8 0 M200 77 l0 7 m-4-3.5 l8 0'],
    ['#ab8f6f', 'M36 180 q20-5 36-2 M81 183 q34 3 60-1 M163 180 q19 2 37-1 M182 187 l12 0'],
  ].map(([color, data]) => [color, new Path2D(data)]);
  // Keep the original library illustration while leaving the practice tail clear.
  const foxFur = new Path2D('M60 39 L66 48 M66 43 L72 51 M157 47 L165 40 M154 53 L164 46 M184 139 L178 149 M190 138 L182 151 M197 134 L187 152 M148 152 L141 162 M154 152 L147 165');

  function measures(data) {
    const path = document.createElementNS(svgNamespace, 'path');
    path.setAttribute('d', data);
    const length = path.getTotalLength();
    return { length, end: path.getPointAtLength(length) };
  }

  function parseStroke(data) {
    // Separate pen lifts so the replay draws each mark in sequence. Lowercase
    // moves are relative to the preceding stroke's endpoint.
    const chunks = data.match(/[Mm][^Mm]*/g) || [];
    let end = { x: 0, y: 0 };
    return chunks.map(chunk => {
      let normalized = chunk;
      if (chunk.startsWith('m')) {
        const move = chunk.match(/^m\s*(-?(?:\d*\.)?\d+)[\s,]*(-?(?:\d*\.)?\d+)(.*)$/);
        if (move) {
          const [, x, y, commands] = move;
          normalized = `M${end.x + Number(x)} ${end.y + Number(y)}${commands}`;
        }
      }
      const geometry = measures(normalized);
      end = geometry.end;
      return { path: new Path2D(normalized), length: geometry.length };
    });
  }

  function prepare(lesson) {
    let data = pathsByLesson.get(lesson);
    if (!data) {
      const stages = lesson.steps.map(([, , , , ...paths]) => paths.map(path => ({
        data: path,
        path: new Path2D(path),
        animation: null,
      })));
      const previewWashes = lesson.previewColors
        ? lesson.previewColors.map(([color, step, stroke]) => [color, stages[step][stroke].path])
        : (washes[lesson.id] || []).map(([color, path]) => [color, new Path2D(path)]);
      data = { stages, washes: previewWashes };
      pathsByLesson.set(lesson, data);
    }
    return data;
  }

  function paint(graphics, data, hero) {
    graphics.save();
    for (const [color, path] of data.washes) {
      graphics.fillStyle = color;
      graphics.globalAlpha = hero ? 0.47 : 0.39;
      graphics.fill(path);
      // Light directional wash within the same silhouette.
      graphics.save();
      graphics.clip(path);
      const wash = graphics.createLinearGradient(225, 190, 45, 18);
      wash.addColorStop(0, color);
      wash.addColorStop(1, '#fffdf5');
      graphics.globalAlpha = 0.23;
      graphics.fillStyle = wash;
      graphics.fillRect(0, 0, artWidth, artHeight);
      graphics.restore();
    }

    if (hero) {
      graphics.lineWidth = 1.2;
      graphics.globalAlpha = 0.77;
      for (const [color, path] of foxScene) {
        graphics.strokeStyle = color;
        graphics.stroke(path);
      }
    }
    graphics.restore();
  }

  function pencil(graphics, strokes) {
    graphics.save();
    graphics.strokeStyle = '#544536';
    graphics.globalAlpha = 0.17;
    graphics.lineWidth = 2.15;
    graphics.translate(0.5, 0.35);
    for (const { path } of strokes) graphics.stroke(path);
    graphics.restore();

    graphics.strokeStyle = '#493a31';
    graphics.lineWidth = 1.45;
    for (const { path } of strokes) graphics.stroke(path);
  }

  function replay(graphics, strokes, progress) {
    if (progress === 0) return;
    if (progress === 1) {
      for (const { path } of strokes) graphics.stroke(path);
      return;
    }

    const parts = strokes.flatMap(stroke => {
      stroke.animation ||= parseStroke(stroke.data);
      return stroke.animation;
    });
    const fullLength = parts.reduce((total, part) => total + part.length, 0);
    let revealed = progress * fullLength;

    for (const { path, length } of parts) {
      if (revealed <= 0) break;
      if (revealed < length) graphics.setLineDash([revealed, length + 1]);
      graphics.stroke(path);
      graphics.setLineDash([]);
      revealed -= length;
    }
  }

  function skillStroke(graphics, data, color, thickness, progress) {
    graphics.strokeStyle = color;
    graphics.lineWidth = thickness;
    replay(graphics, [data], progress);
  }

  function artPath(data) {
    return { data, path: new Path2D(data) };
  }

  const marks = ['M23 77 Q83 57 151 75', 'M209 77 Q269 57 337 75'].map(artPath);
  const textures = Object.fromEntries(Object.entries(foxTailTextures).map(([name, { light, dark }]) => [
    name, [artPath(light), artPath(dark)],
  ]));

  function drawPractice(graphics, width, height, lesson, { activity, progress = 1, startClue, tailTexture }) {
    const onTail = activity === 'tail';
    const frame = onTail ? { x: 108, y: 81, width: 123, height: 106 } : { x: 0, y: 0, width: 360, height: 144 };
    const scale = Math.min(width / frame.width, height / frame.height);
    graphics.save();
    graphics.translate((width - frame.width * scale) / 2, (height - frame.height * scale) / 2);
    graphics.scale(scale, scale);
    graphics.translate(-frame.x, -frame.y);
    graphics.lineCap = 'round';
    graphics.lineJoin = 'round';

    if (onTail) {
      const { stages } = prepare(lesson);
      graphics.strokeStyle = '#9d9089';
      graphics.globalAlpha = 0.7;
      graphics.lineWidth = 1.2;
      for (const index of [2, 3]) {
        for (const { path } of stages[index]) graphics.stroke(path);
      }
      graphics.globalAlpha = 1;
    } else {
      graphics.fillStyle = '#2b2a3a';
      graphics.textAlign = 'center';
      graphics.font = '700 19px system-ui, sans-serif';
      graphics.fillText('Light', 87, 111);
      graphics.fillText('Dark', 273, 111);
    }

    const [light, dark] = onTail ? textures[tailTexture] : marks;
    const lightProgress = Math.min(1, progress * 2);
    const darkProgress = Math.max(0, progress * 2 - 1);
    skillStroke(graphics, light, '#776e68', onTail ? 2.2 : 5, lightProgress);
    skillStroke(graphics, dark, '#292630', onTail ? 3.6 : 9, darkProgress);

    if (!onTail && startClue) {
      graphics.strokeStyle = '#6237aa';
      graphics.lineWidth = 2.5;
      for (const x of [23, 209]) {
        graphics.beginPath();
        graphics.arc(x, 77, 8, 0, Math.PI * 2);
        graphics.stroke();
      }
    }
    graphics.restore();
  }

  return function render(canvas, lesson, stepIndex = lesson.steps.length - 1, options = {}) {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (!width || !height) return;
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 3);
    const pixelsWide = Math.round(width * pixelRatio);
    const pixelsHigh = Math.round(height * pixelRatio);
    if (canvas.width !== pixelsWide) canvas.width = pixelsWide;
    if (canvas.height !== pixelsHigh) canvas.height = pixelsHigh;

    const graphics = canvas.getContext('2d');
    graphics.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    graphics.clearRect(0, 0, width, height);
    if (options.activity) {
      drawPractice(graphics, width, height, lesson, options);
      return;
    }
    if (stepIndex < 0) return;

    const scale = Math.min(width / artWidth, height / artHeight) * (options.scale ?? 1);
    const progress = Math.max(0, Math.min(1, options.progress ?? 1));
    const currentStep = Math.min(stepIndex, lesson.steps.length - 1);
    const { stages, washes: washesForLesson } = prepare(lesson);

    graphics.save();
    graphics.translate((width - artWidth * scale) / 2, (height - artHeight * scale) / 2);
    graphics.scale(scale, scale);
    graphics.lineCap = 'round';
    graphics.lineJoin = 'round';

    if ((options.decorative || options.hero) && !options.teaching && !options.guide) {
      paint(graphics, { washes: washesForLesson }, options.hero);
      if (lesson.id === 'little-fox') pencil(graphics, [{ path: foxFur }]);
    }

    const drawingStart = lesson.drawingStart ?? 0;
    // Observation cues belong to their own demo, outside the accumulated sketch.
    const firstStep = options.teaching && currentStep < drawingStart ? 0 : drawingStart;
    for (let index = firstStep; index <= currentStep; index += 1) {
      const strokes = stages[index];
      if (options.guide) {
        const isCurrent = index === currentStep;
        graphics.strokeStyle = isCurrent ? '#7657c5' : '#3a3a48';
        graphics.globalAlpha = isCurrent ? 0.55 : 0.25;
        graphics.lineWidth = 1.25;
        graphics.setLineDash(isCurrent ? [2.5, 2] : []);
        for (const { path } of strokes) graphics.stroke(path);
        graphics.setLineDash([]);
      } else if (options.teaching) {
        const isCurrent = index === currentStep;
        graphics.strokeStyle = isCurrent ? '#e4572e' : '#3a3a48';
        graphics.globalAlpha = isCurrent ? 1 : 0.5;
        graphics.lineWidth = isCurrent ? 2.45 : 1.5;
        replay(graphics, strokes, isCurrent ? progress : 1);
      } else {
        pencil(graphics, strokes);
      }
    }
    graphics.restore();
  };
})();
