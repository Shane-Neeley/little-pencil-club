// Drive the real UI and compare retained progress with an independent model.
const assert = require('node:assert/strict');
const { createServer } = require('node:http');
const { readFile } = require('node:fs/promises');
const { extname, join, resolve } = require('node:path');
const { chromium } = require(process.env.PENCIL_TEST_PLAYWRIGHT || 'playwright');

const dist = resolve(process.argv[2] || './dist');
const mime = {'.css':'text/css', '.html':'text/html', '.js':'text/javascript','.png':'image/png','.svg':'image/svg+xml'};
const server = createServer(async (request, response) => {
  const path = new URL(request.url, 'http://127.0.0.1').pathname;
  try {
    const file = join(dist, path === '/' ? 'index.html' : path);
    response.setHeader('Content-Type', mime[extname(file)] || 'application/octet-stream');
    response.end(await readFile(file));
  } catch { response.writeHead(404).end(); }
});

const samples = [
  ['pencil-basics', 'Pencil Basics', ['Try light and dark']],
  ['axolotl', 'Smiley axolotl', ['Draw a round head', 'Add the body', 'Draw the gills', 'Give it a smile']],
  ['berry-cupcake', 'Berry cupcake', ['Make the wrapper', 'Swirl the frosting', 'Put a berry on top', 'Add stripes and sprinkles']],
];
const states = new Map(samples.map(([id, title, steps]) => [id, {title, steps}]));
const format = 'little-pencil-club-progress';
const count = snapshot => [...snapshot.values()].filter(state => state.complete).length;

async function checkDrawNext(browser, origin) {
  const mobile = await browser.newContext({ viewport: { width: 320, height: 568 }, isMobile: true, hasTouch: true });
  try {
    await mobile.route(url => url.origin !== origin, route => route.abort());
    const page = await mobile.newPage();
    await page.goto(origin);
    const fox = page.getByRole('link', { name: 'Draw the little fox', exact: true });
    const surprise = page.getByRole('button', { name: 'Surprise me', exact: true });
    const suggestion = page.locator('.draw-next-lesson');
    const announcement = page.locator('.draw-next [role="status"]');
    const before = await page.evaluate(() => Object.entries(localStorage));
    assert.equal(await fox.getAttribute('href'), '#draw/little-fox');
    assert.equal(await suggestion.isVisible(), false);
    await surprise.tap();
    const first = await suggestion.getAttribute('href');
    assert.match(first, /^#draw\//);
    assert.match(await announcement.textContent(), /^Suggested lesson: /);
    assert.equal(await page.evaluate(() => location.hash), '');
    await surprise.focus();
    await page.keyboard.press('Enter');
    assert.notEqual(await suggestion.getAttribute('href'), first);
    assert.equal(await surprise.evaluate(node => node === document.activeElement), true);
    const topics = page.getByRole('group', { name: 'Lesson topics' });
    const levels = page.getByRole('group', { name: 'Lesson levels' });
    await topics.getByRole('button', { name: 'Skills', exact: true }).tap();
    assert.equal(await suggestion.isVisible(), false);
    assert.equal(await suggestion.getAttribute('href'), null);
    assert.equal(await announcement.textContent(), '');
    await levels.getByRole('button', { name: 'Hard', exact: true }).tap();
    assert.equal(await surprise.isVisible(), false);
    assert.equal(await page.getByText('Try another topic or level.').isVisible(), true);
    await topics.getByRole('button', { name: 'Animals', exact: true }).tap();
    await levels.getByRole('button', { name: 'Easy', exact: true }).tap();
    const visible = await page.locator('#lesson-cards a.lesson-card').evaluateAll(cards => cards.map(card => card.getAttribute('href')));
    assert.ok(visible.length);
    await surprise.tap();
    const selected = await suggestion.getAttribute('href');
    assert.ok(visible.includes(selected));
    assert.deepEqual(await page.evaluate(() => Object.entries(localStorage)), before);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    const title = (await suggestion.textContent()).replace(/^Draw: /, '');
    await suggestion.tap();
    await page.waitForURL(url => url.hash === selected);
    await page.getByRole('heading', { name: title, exact: true }).waitFor();
    console.log('Draw Next opens a filtered lesson, supports keyboard/touch, and fits 320×568');
  } finally {
    await mobile.close();
  }
}

async function main() {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch({
    executablePath: process.env.PENCIL_TEST_CHROMIUM_PATH,
    args: ['--disable-background-networking', '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1'],
  });
  try {
    await checkDrawNext(browser, origin);
    const context = await browser.newContext({reducedMotion:'reduce'});
    await context.addInitScript(() => { Date.now = () => 1785000000123; });
    await context.route(url => url.origin !== origin, route => route.abort());
    const page = await context.newPage();
    const peer = await context.newPage();
    const enter = async (tab,id,index=0) => {
      const {title, steps} = states.get(id);
      await tab.goto(origin+'/#draw/'+id);
      await tab.getByRole('heading',{name:title,exact:true}).waitFor();
      await tab.getByRole('heading',{name:steps[index],exact:true}).waitFor();
    };
    const button = (tab, name) => tab.getByRole('group',{name:'Paper lesson controls'}).getByRole('button',{name, exact:true});
    const book = async tab => {
      await tab.goto(origin+'/#sketchbook');
      await tab.getByRole('heading',{name:'Your sketchbook'}).waitFor();
    };
    const viewCount = async tab => Number((await tab.locator('.book-description').innerText()).match(/^\d+/)[0]);
    const freshBook = async tab => {
      await book(tab);
      await tab.reload();
      await tab.getByRole('heading',{name:'Your sketchbook'}).waitFor();
    };
    const controls = async tab => {
      const panel = tab.locator('.progress-files');
      if (!await panel.evaluate(node=>node.open)) await panel.locator('summary').click();
      return panel;
    };
    const payload = completed => ({format, version:1, completed});
    const openFile = async (tab, content, status) => {
      const panel = await controls(tab);
      await panel.locator('input').setInputFiles({
        name:'progress.json',
        mimeType:'application/json',
        buffer:Buffer.from(JSON.stringify(content)),
      });
      await panel.getByRole('status').getByText(status, {exact:true}).waitFor();
    };
    const exportFile = async tab => {
      const panel = await controls(tab);
      const [download] = await Promise.all([tab.waitForEvent('download'), panel.getByRole('button',{name:'Save progress file'}).click()]);
      assert.equal(download.suggestedFilename(), 'little-pencil-progress.json');
      const streamed = await download.createReadStream();
      const contents = [];
      for await (const chunk of streamed) contents.push(chunk);
      return JSON.parse(Buffer.concat(contents).toString());
    };

    await enter(page, 'pencil-basics');
    await enter(peer, 'pencil-basics');
    await button(page,'Finish').click();
    await page.getByRole('heading',{name:'You drew it!'}).waitFor();
    await freshBook(page);
    assert.equal(await viewCount(page),1);
    // Normal mode changes save the lesson from the second tab's stale snapshot.
    await peer.getByLabel('Drawing mode').selectOption('copy');
    await freshBook(page);
    const race = await viewCount(page);
    console.log(JSON.stringify({case:'two-tab local finish then stale mode change', expected:1, actual:race}));
    const expectedRace = process.env.PENCIL_EXPECT_BASELINE_RACE === '1' ? 0 : 1;
    assert.equal(race,expectedRace);
    await context.close();

    const seedResults=[];
    for (const seed of [0x1245, 0x55e2, 0xc0ffee]) {
      const isolated = await browser.newContext({reducedMotion:'reduce'});
      await isolated.addInitScript(() => { Date.now = () => 1785000000123; });
      await isolated.route(url => url.origin !== origin, route => route.abort());
      const learner=await isolated.newPage();
      const snapshot=new Map(samples.map(([id]) => [id,{step:0,complete:false}]));
      let state=seed;
      const draw=range=>{
        state=(Math.imul(state,1664525)+1013904223)>>>0;
        return Math.floor(state/2**32 * range);
      };
      const run=async (operation,id,index)=>{
        const record=snapshot.get(id);
        if (operation==='advance' || operation==='back' || operation==='finish') {
          await enter(learner,id,record.step);
          const steps=states.get(id).steps;
          if(operation==='finish'){
            while(record.step<steps.length-1){
              await button(learner,'Next').click();
              record.step++;
            }
            await button(learner,'Finish').click();
            await learner.getByRole('heading',{name:'You drew it!'}).waitFor();
            record.complete=true;
          } else if (operation==='back' && record.step>0) {
            await button(learner,'Back').click();
            record.step--;
          } else if (operation==='advance' && record.step<steps.length-1) {
            await button(learner,'Next').click();
            record.step++;
          }
        } else {
          await book(learner);
          if(operation==='import'){
            const ids=[id, ...Array.from({length:2},()=>samples[draw(samples.length)][0]), id];
            if(index%2===0)ids.push('unavailable-lesson');
            const added=new Set(ids.filter(id=>snapshot.has(id)&&!snapshot.get(id).complete));
            const countText=added.size===1?'1 checkmark added.':added.size+' checkmarks added.';
            const unknown=ids.includes('unavailable-lesson')?' Some lessons in this file aren’t available here.':'';
            await openFile(learner, payload(ids), countText+unknown);
            for(const id of added)snapshot.get(id).complete=true;
          } else if(operation==='malformed'){
            await openFile(learner,payload([id, false]),'Choose a progress file saved from Little Pencil Club.');
          } else if(operation==='export'){
            const expected=samples.map(([id])=>id).filter(id=>snapshot.get(id).complete);
            if(expected.length){
              const actual=await exportFile(learner);
              assert.deepEqual(Object.keys(actual).sort(),['completed','format','version']);
              assert.equal(actual.format,format);
              assert.equal(actual.version,1);
              assert.deepEqual(actual.completed.sort(),expected.sort());
            } else assert.equal(await (await controls(learner)).getByRole('button',{name:'Save progress file'}).isEnabled(),false);
          }
        }
        await freshBook(learner);
        assert.equal(await viewCount(learner),count(snapshot),[seed,index,operation,id].join(' '));
        const completed = await learner.locator('.completion-mark').count();
        assert.equal(completed,count(snapshot),[seed,index,operation,id].join(' '));
      };
      const ops=['advance','back','finish','import','malformed','export','reload'];
      await run('advance','axolotl',0);
      await run('malformed','berry-cupcake',1);
      await run('finish','pencil-basics',2);
      await run('import','axolotl',3);
      await run('export','axolotl',4);
      for(let index=5;index<19;index++)await run(ops[draw(ops.length)],samples[draw(samples.length)][0],index);
      seedResults.push({seed:seed.toString(16),commands:19,finished:count(snapshot)});
      await isolated.close();
    }
    console.log(JSON.stringify({case:'seeded progress parity',seeds:seedResults}));
  } finally {
    await browser.close();
  }
}

main().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>server.close());
