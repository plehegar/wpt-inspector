var fs = require('fs');
var parse5 = require('parse5');
var promises = require('promises');

if (!String.prototype.startsWith) {
  Object.defineProperty(String.prototype, 'startsWith', {
    enumerable: false,
    configurable: false,
    writable: false,
    value: function(searchString, position) {
      position = position || 0;
      return this.lastIndexOf(searchString, position) === position;
    }
  });
}
if (!String.prototype.endsWith) {
  Object.defineProperty(String.prototype, 'endsWith', {
    value: function(searchString, position) {
      var subjectString = this.toString();
      if (position === undefined || position > subjectString.length) {
        position = subjectString.length;
      }
      position -= searchString.length;
      var lastIndex = subjectString.indexOf(searchString, position);
      return lastIndex !== -1 && lastIndex === position;
    }
  });
}


var html;

function addToRecord(url, elementName, attrName) {
  var entry = elementName;
  if (attrName !== undefined) {
    entry += "-" + attrName;
  }
  var set = html[entry];
  if (set === undefined) {
    var errorMsg = "404 Element %s";
    if (attrName !== undefined) {
      errorMsg += " Attr %s";
      console.log(errorMsg, elementName, attrName);
    } else {
      console.log(errorMsg, elementName);
    }
  } else {
    set.push(url);
  }
}

function walkDom(element, url) {
  switch (element.nodeName) {
  case '#documentType':
  case '#text':
  case '#comment':
    break;
  default:
    if (element.nodeName !== "#document"
        && element.nodeName !== "#document-fragment") {
      addToRecord(url, element.nodeName);
      if (element.attrs === undefined) {
        console.log("500 No attributes for %s", element.nodeName);
      } else {
        for (var i = 0; i < element.attrs.length; i++) {
          addToRecord(url, element.nodeName, element.attrs[i].name);
          if (element.attrs[i].name === undefined) {
            console.log(element.attrs[i]);
          }
        }
      }
    }
    if (element.childNodes !== undefined) {
      for (var c = 0; c < element.childNodes.length; c++) {
        walkDom(element.childNodes[c], url);
      }
    } else {
      console.log("500 childNodes undefined %s", element.nodeName);
    }
  }
}

function handleTest(url, location, next) {
  console.log("200 Processing " + url);
  fs.readFile(location, {encoding: "utf-8"}, function (err, data) {
    if (err) {
      console.log("500 %s", url);
      console.log(err);
    } else {
      try {
        var parser = new parse5.Parser();
        var document = parser.parse(data);
        walkDom(document, url);
      } catch (e) {
        console.log("500 Error on %s", url);
        console.log(e);
      }
    }
    next();
  });
}


function walk(wptRepoPath, fileFilter, end) {
  var testList = [];
  var index = 0;
  var repoLength = wptRepoPath.length;

  function load(path) {
    var files = fs.readdirSync(path);
    for (var i = files.length - 1; i >= 0; i--) {
      var fileName = files[i];
      var file     = path + '/' + fileName;
      if (fileName !== ".git") {
        var stats    = fs.statSync(file);
        if (stats.isDirectory()) {
          load(file);
        } else if (stats.isFile() && fileFilter(file.substring(repoLength))) {
          console.log("accepted %s", file);
          testList.push(file);
        }
      }
    }
  }

  function iterate() {
    if (index < testList.length) {
      var relativeTest = testList[index];
      index++;
      if (fileFilter(relativeTest)) {
        handleTest(relativeTest, relativeTest, iterate);
      } else {
        iterate();
      }
    } else {
      end();
    }
  }
  load(wptRepoPath);
  console.log("Loaded %d files", testList.length);
//  iterate();
}

// flatten the list of elements/attrs
require('./htmlspec-data.js')().then(function (elements) {
  var obj = {};
  for (var i = 0; i < elements.length; i++) {
    var element = elements[i];
    obj[element.name] = [];
    for (var j = 0; j < element.attrs.length; j++) {
      obj[element.name + "-" + element.attrs[j]] = [];
    }
  }
  html = obj;

  function end() {
    fs.writeFileSync("wptdata.json", JSON.stringify(html), {encoding:"utf-8"});
    analyze();
  }

  var wptRepoDir = "/home/plehegar/git/web-platform-tests";

  function filter(path) {
    return path.startsWith("/html/") && !path.startsWith("/html/syntax/")
      && (path.endsWith(".html") || path.endsWith(".htm"));
  }
  walk(wptRepoDir, filter, end);
}, function (err) {
  console.log("500 No HTML Index data received");
});



function analyze() {
  var report = "";
  for (var key in html) {
    var name = key;
    var attrName = undefined;
    var index = name.indexOf("-");
    if (index !== -1) {
      name = key.substring(0, index);
      attrName = key.substring(index+1);
      report += "Attribute " + name + " " + attrName + " " + html[key].length + "\n";
    } else {
      report += "Element " + name + " " + html[key].length + "\n";
    }
  }
  fs.writeFileSync("report.txt", report, {encoding:"utf-8"});
}
