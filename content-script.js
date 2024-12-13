/**
 * reference:
 *  https://en.wikipedia.org/wiki/CJK_Unified_Ideographs
 *  https://en.wikipedia.org/wiki/CJK_Symbols_and_Punctuation
 *  http://jrgraphix.net/r/Unicode/
 */

const list = [
  "\\u1100-\\u11FF", // Hangul Jamo
  "\\u2E80-\\u2EFF", // CJK Radicals Supplement
  "\\u2F00-\\u2FDF", // Kangxi Radicals
  "\\u2FF0-\\u2FFF", // Ideographic Description Characters
  "\\u3000-\\u303F", // CJK Symbols and Punctuation
  "\\u3040-\\u309F", // Hiragana
  "\\u30A0-\\u30FF", // Katakana
  "\\u3100-\\u312F", // Bopomofo
  "\\u3130-\\u318F", // Hangul Compatibility Jamo
  "\\u3190-\\u319F", // Kanbun 不是很懂你们日本人的“汉”文……
  "\\u31A0-\\u31BF", // Bopomofo Extended
  "\\u31F0-\\u31FF", // Katakana Phonetic Extensions
  "\\u3200-\\u32FF", // Enclosed CJK Letters and Months
  "\\u3300-\\u33FF", // CJK Compatibility
  //  '\\u3300-\\u33FF\\uFE30-\\uFE4F\\uF900-\\uFAFF\\u{2F800}-\\u{2FA1F}', // Other CJK Ideographs in Unicode, not Unified
  "\\u3400-\\u4DBF", // Ext-A
  "\\u4DC0-\\u4DFF", // Yijing Hexagram Symbols, 为了收集这些字符我已经累到怀疑人生了，谁来给我算一卦……
  "\\u4E00-\\u9FFF", // CJK
  "\\uAC00-\\uD7AF", // Hangul Syllables
  "\\uF900-\\uFAFF", // CJK Compatibility Ideograph
  "\\uFE30-\\uFE4F", // CJK Compatibility Forms, 竖排样式的横排字符……
  "\\uFF00-\\uFFEF", // Halfwidth and Fullwidth Forms
  "\\u{1D300}-\\u{1D35F}", // Tai Xuan Jing Symbols,
  "\\u{20000}-\\u{2A6DF}", // Ext-B
  "\\u{2A700}-\\u{2B73F}", // Ext-C
  "\\u{2B740}-\\u{2B81F}", // Ext-D
  "\\u{2B820}-\\u{2CEAF}", // Ext-E
  "\\u{2CEB0}-\\u{2EBEF}", // Ext-F
  "\\u{2F800}-\\u{2FA1F}", // CJK Compatibility Ideographs Supplement, 补充包你好，补充包再见
];

let regex;

try {
  regex = new RegExp(`[${list.join("")}]`, "u");
} catch (e) {
  regex = new RegExp(`[${list.slice(0, 21).join("")}]`);
}

const sendBackgroundMessage = (payload) => {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(payload, resolve);
  });
};

function isChinese(text) {
  return regex.test(text);
}

const hasChinese = isChinese;

const createRubyNode = (character, pinyin) => {
  const ruby = document.createElement("ruby");
  const leftRP = document.createElement("rp");
  const rightRP = document.createElement("rp");
  const rt = document.createElement("rt");
  const characterNode = document.createTextNode(character);
  leftRP.textContent = "(";
  rightRP.textContent = ")";
  rt.textContent = pinyin;
  rt.style.userSelect = "none";
  ruby.appendChild(characterNode);
  ruby.appendChild(leftRP);
  ruby.appendChild(rt);
  ruby.appendChild(rightRP);
  rt.style.fontSize = "70%";
  rt.style.padding = "0 1px";
  return ruby;
};

function traverseTextNodes(node, callback) {
  // 如果当前节点是文本节点，进行处理
  if (node.nodeType === Node.TEXT_NODE) {
    callback(node);
  }

  // 遍历所有子节点
  let child = node.firstChild;
  while (child) {
    traverseTextNodes(child, callback);
    child = child.nextSibling;
  }
}

const getTextNodesFromSelection = (selection) => {
  if (selection.rangeCount === 0 || selection.toString() === "") {
    return [];
  }

  const range = selection.getRangeAt(0);

  if (range.collapsed) {
    return [];
  }

  const { startContainer, startOffset, endOffset, endContainer } = range;

  let commonAncestorContainer = range.commonAncestorContainer;

  if (commonAncestorContainer.nodeType === Node.TEXT_NODE) {
    const startNode = commonAncestorContainer.splitText(startOffset);
    startNode.splitText(endOffset - startOffset);
    return [startNode];
  }

  const textNodes = [];
  let start = false;
  let end = false;
  traverseTextNodes(commonAncestorContainer, (node) => {
    if (end) return;
    if (!node) return;
    const isStartContainer = startContainer === node;
    const isEndContainer = endContainer === node;
    if (!start && !isStartContainer) {
      return;
    }
    const isNode =
      node.parentNode.nodeName !== "RUBY" &&
      node.parentNode.nodeName !== "SCRIPT" &&
      hasChinese(node.nodeValue);
    if (isStartContainer) {
      start = true;
      if (isNode) {
        const startNode = node.splitText(startOffset);
        textNodes.push(startNode);
      }
    } else if (isEndContainer) {
      end = true;
      if (isNode) {
        node.splitText(endOffset);
        textNodes.push(node);
      }
    } else if (isNode) {
      textNodes.push(node);
    }
  });
  return textNodes;
};

const getCharactersFromTextNodes = (textNodes) => {
  const characters = new Set();
  textNodes.forEach((node) => {
    for (const character of node.textContent) {
      if (character && isChinese(character)) {
        characters.add(character);
      }
    }
  });
  return characters;
};

const annotateTextNodesWithPinyin = (textNodes, characterToPinyinMap) => {
  console.time("annotateTextNodesWithPinyin");
  for (const node of textNodes) {
    const fragment = document.createDocumentFragment();
    for (const character of node.nodeValue) {
      if (character in characterToPinyinMap) {
        fragment.appendChild(
          createRubyNode(character, characterToPinyinMap[character])
        );
      } else {
        fragment.appendChild(document.createTextNode(character));
      }
    }
    node.parentElement?.replaceChild(fragment, node);
  }
  console.timeEnd("annotateTextNodesWithPinyin");
};

async function main() {
  console.log(window.getSelection());
  const textNodes = getTextNodesFromSelection(window.getSelection());
  const characters = getCharactersFromTextNodes(textNodes);
  console.log(characters);

  const characterToPinyinMap = await sendBackgroundMessage({
    characters: Array.from(characters),
  });

  annotateTextNodesWithPinyin(textNodes, characterToPinyinMap);
}

chrome.runtime.onMessage.addListener((message, sender) => {
  if (message.type === "pinyin-show") {
    main();
  }
});

window.addEventListener("keyup", (e) => {
  if (e.altKey && (e.key === "p" || e.key === "b")) {
    main();
  }
});
