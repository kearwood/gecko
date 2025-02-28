/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

/**
 * Test AudioNode#source
 */

add_task(async function () {
  let { target, front } = await initBackend(SIMPLE_NODES_URL);
  let [_, nodes] = await Promise.all([
    front.setup({ reload: true }),
    getN(front, "create-node", 14)
  ]);

  let actualTypes = nodes.map(node => node.type);
  let isSourceResult = nodes.map(node => node.source);

  actualTypes.forEach((type, i) => {
    let shouldBeSource = type === "AudioBufferSourceNode" || type === "OscillatorNode";
    if (shouldBeSource)
      is(isSourceResult[i], true, type + "'s `source` is `true`");
    else
      is(isSourceResult[i], false, type + "'s `source` is `false`");
  });

  await removeTab(target.tab);
});
