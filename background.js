import "./pinyin-pro.js";

chrome.runtime.onInstalled.addListener(async (e) => {
  chrome.contextMenus.create({
    id: "pinyin",
    title: "加上拼音 %s",
    contexts: ["selection"],
  });
});

// Open a new search tab when the user clicks a context menu
chrome.contextMenus.onClicked.addListener((item, tab) => {
  chrome.tabs.sendMessage(tab.id, {
    type: "pinyin-show",
  });
});

const fetchCharactersMapping = (characters) => {
  const out = {};
  for (const char of characters) {
    out[char] = globalThis.pinyinPro.pinyin(char);
  }
  return out;
};

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const { characters } = message;
  console.log(characters);
  sendResponse(fetchCharactersMapping(characters));
});
