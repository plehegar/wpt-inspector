var http = require('http');
var fs = require('fs');
var parse5 = require('parse5');
var promises = require('promises');

var elements = [];

// @@ will need to extract this automatically
var globals = [
  "accesskey",
  "class",
  "contenteditable",
  "contextmenu",
  "dir",
  "draggable",
  "dropzone",
  "hidden",
  "id",
  "itemid",
  "itemprop",
  "itemref",
  "itemscope",
  "itemtype",
  "lang",
  "spellcheck",
  "style",
  "tabindex",
  "title",
  "translate"
];

// @@ will need to extract this automatically
var events = [
  "onabort",
  "onautocomplete",
  "onautocompleteerror",
  "onblur",
  "oncancel",
  "oncanplay",
  "oncanplaythrough",
  "onchange",
  "onclick",
  "onclose",
  "oncontextmenu",
  "oncuechange",
  "ondblclick",
  "ondrag",
  "ondragend",
  "ondragenter",
  "ondragexit",
  "ondragleave",
  "ondragover",
  "ondragstart",
  "ondrop",
  "ondurationchange",
  "onemptied",
  "onended",
  "onerror",
  "onfocus",
  "oninput",
  "oninvalid",
  "onkeydown",
  "onkeypress",
  "onkeyup",
  "onload",
  "onloadeddata",
  "onloadedmetadata",
  "onloadstart",
  "onmousedown",
  "onmouseenter",
  "onmouseleave",
  "onmousemove",
  "onmouseout",
  "onmouseover",
  "onmouseup",
  "onmousewheel",
  "onpause",
  "onplay",
  "onplaying",
  "onprogress",
  "onratechange",
  "onreset",
  "onresize",
  "onscroll",
  "onseeked",
  "onseeking",
  "onselect",
  "onshow",
  "onsort",
  "onstalled",
  "onsubmit",
  "onsuspend",
  "ontimeupdate",
  "ontoggle",
  "onvolumechange",
  "onwaiting"
]

function getElements(element, elementSelector) {
  var list = [];

  function getId(element) {
    if (element.attrs !== undefined) {
      for (var i = 0; i < element.attrs.length; i++) {
        var attr = element.attrs[i];
        if (attr.name === "id") {
          return attr.value;
        }
      }
    }
    return undefined;
  }

  function walk(node) {
    switch (node.nodeName) {
    case '#text':
    case '#comment':
    case '#documentType':
      break;
    case elementSelector:
      list.push(node);
      break;
    default:
      if (elementSelector.charAt(0) === '#'
          && (getId(node) === elementSelector.substring(1))) {
        list.push(node);
      } else {
        if (node.childNodes !== undefined) {
          for (var c = 0; c < node.childNodes.length; c++) {
            walk(node.childNodes[c]);
          }
        }
      }
    }
  }

  walk(element);
  return list;
}

function getTextContent(element) {
  var content = "";

  function walk(node) {
    switch (node.nodeName) {
    case '#comment':
    case '#documentType':
      break;
    case '#text':
      content += node.value;
      break;
    default:
      if (node.childNodes !== undefined) {
        for (var c = 0; c < node.childNodes.length; c++) {
          walk(node.childNodes[c]);
        }
      }
    }
  }

  walk(element);
  return content;
}

function add(name, tds) {
  var elt = {};
  elt.name = name;
  var codes = getElements(tds[4], "code");
  elt.attrs = [];
  for (var i = 0; i < globals.length; i++) {
    elt.attrs.push(globals[i]);
  }
  for (var i = 0; i < codes.length; i++) {
    elt.attrs.push(getTextContent(codes[i]));
  }
  elt.idl = getTextContent(tds[5]);
  elements.push(elt);
}

function addElement(tr) {
  var ths = getElements(tr, "th");
  var tds = getElements(tr, "td");
  if (tds.length !== 6 || ths.length !== 1) {
    throw new Error("invalid file format");
  }
  var name = getTextContent(ths[0]);
  if (name.indexOf(",") !== -1) {
    var names = name.split(",");
    for (var i = 0; i < names.length; i++) {
      add(names[i].trim(), tds);
    }
  } else {
    add(name, tds);
  }
}

function getHTMLIndex(callback) {
  http.get("http://www.w3.org/html/wg/drafts/html/master/index.html",
           function (res) {
    var buffer = "";
    res.on('data', function (chunk) {
      buffer += chunk;
    });
    res.on('end', function (chunk) {
      var parser = new parse5.Parser();
      var document = parser.parse(buffer);
      var tables = getElements(document.childNodes[1], "table");
      var trs = getElements(getElements(tables[0], "tbody")[0], "tr");
      for (var i = 0; i < trs.length; i++) {
        addElement(trs[i]);
      }
      callback(undefined, elements);
    });
  }).on('error', function(err) {
          if (callback !== undefined) callback(err);
  });
}

module.exports = promises.wrap(getHTMLIndex);
