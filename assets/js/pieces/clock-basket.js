(function () {
  'use strict';

  var hyperscriptAttributeToProperty = attributeToProperty;

  var transform = {
    'class': 'className',
    'for': 'htmlFor',
    'http-equiv': 'httpEquiv'
  };

  function attributeToProperty (h) {
    return function (tagName, attrs, children) {
      for (var attr in attrs) {
        if (attr in transform) {
          attrs[transform[attr]] = attrs[attr];
          delete attrs[attr];
        }
      }
      return h(tagName, attrs, children)
    }
  }

  var VAR = 0, TEXT = 1, OPEN = 2, CLOSE = 3, ATTR = 4;
  var ATTR_KEY = 5, ATTR_KEY_W = 6;
  var ATTR_VALUE_W = 7, ATTR_VALUE = 8;
  var ATTR_VALUE_SQ = 9, ATTR_VALUE_DQ = 10;
  var ATTR_EQ = 11, ATTR_BREAK = 12;
  var COMMENT = 13;

  var hyperx = function (h, opts) {
    if (!opts) opts = {};
    var concat = opts.concat || function (a, b) {
      return String(a) + String(b)
    };
    if (opts.attrToProp !== false) {
      h = hyperscriptAttributeToProperty(h);
    }

    return function (strings) {
      var state = TEXT, reg = '';
      var arglen = arguments.length;
      var parts = [];

      for (var i = 0; i < strings.length; i++) {
        if (i < arglen - 1) {
          var arg = arguments[i+1];
          var p = parse(strings[i]);
          var xstate = state;
          if (xstate === ATTR_VALUE_DQ) xstate = ATTR_VALUE;
          if (xstate === ATTR_VALUE_SQ) xstate = ATTR_VALUE;
          if (xstate === ATTR_VALUE_W) xstate = ATTR_VALUE;
          if (xstate === ATTR) xstate = ATTR_KEY;
          if (xstate === OPEN) {
            if (reg === '/') {
              p.push([ OPEN, '/', arg ]);
              reg = '';
            } else {
              p.push([ OPEN, arg ]);
            }
          } else if (xstate === COMMENT && opts.comments) {
            reg += String(arg);
          } else if (xstate !== COMMENT) {
            p.push([ VAR, xstate, arg ]);
          }
          parts.push.apply(parts, p);
        } else parts.push.apply(parts, parse(strings[i]));
      }

      var tree = [null,{},[]];
      var stack = [[tree,-1]];
      for (var i = 0; i < parts.length; i++) {
        var cur = stack[stack.length-1][0];
        var p = parts[i], s = p[0];
        if (s === OPEN && /^\//.test(p[1])) {
          var ix = stack[stack.length-1][1];
          if (stack.length > 1) {
            stack.pop();
            stack[stack.length-1][0][2][ix] = h(
              cur[0], cur[1], cur[2].length ? cur[2] : undefined
            );
          }
        } else if (s === OPEN) {
          var c = [p[1],{},[]];
          cur[2].push(c);
          stack.push([c,cur[2].length-1]);
        } else if (s === ATTR_KEY || (s === VAR && p[1] === ATTR_KEY)) {
          var key = '';
          var copyKey;
          for (; i < parts.length; i++) {
            if (parts[i][0] === ATTR_KEY) {
              key = concat(key, parts[i][1]);
            } else if (parts[i][0] === VAR && parts[i][1] === ATTR_KEY) {
              if (typeof parts[i][2] === 'object' && !key) {
                for (copyKey in parts[i][2]) {
                  if (parts[i][2].hasOwnProperty(copyKey) && !cur[1][copyKey]) {
                    cur[1][copyKey] = parts[i][2][copyKey];
                  }
                }
              } else {
                key = concat(key, parts[i][2]);
              }
            } else break
          }
          if (parts[i][0] === ATTR_EQ) i++;
          var j = i;
          for (; i < parts.length; i++) {
            if (parts[i][0] === ATTR_VALUE || parts[i][0] === ATTR_KEY) {
              if (!cur[1][key]) cur[1][key] = strfn(parts[i][1]);
              else parts[i][1]==="" || (cur[1][key] = concat(cur[1][key], parts[i][1]));
            } else if (parts[i][0] === VAR
            && (parts[i][1] === ATTR_VALUE || parts[i][1] === ATTR_KEY)) {
              if (!cur[1][key]) cur[1][key] = strfn(parts[i][2]);
              else parts[i][2]==="" || (cur[1][key] = concat(cur[1][key], parts[i][2]));
            } else {
              if (key.length && !cur[1][key] && i === j
              && (parts[i][0] === CLOSE || parts[i][0] === ATTR_BREAK)) {
                // https://html.spec.whatwg.org/multipage/infrastructure.html#boolean-attributes
                // empty string is falsy, not well behaved value in browser
                cur[1][key] = key.toLowerCase();
              }
              if (parts[i][0] === CLOSE) {
                i--;
              }
              break
            }
          }
        } else if (s === ATTR_KEY) {
          cur[1][p[1]] = true;
        } else if (s === VAR && p[1] === ATTR_KEY) {
          cur[1][p[2]] = true;
        } else if (s === CLOSE) {
          if (selfClosing(cur[0]) && stack.length) {
            var ix = stack[stack.length-1][1];
            stack.pop();
            stack[stack.length-1][0][2][ix] = h(
              cur[0], cur[1], cur[2].length ? cur[2] : undefined
            );
          }
        } else if (s === VAR && p[1] === TEXT) {
          if (p[2] === undefined || p[2] === null) p[2] = '';
          else if (!p[2]) p[2] = concat('', p[2]);
          if (Array.isArray(p[2][0])) {
            cur[2].push.apply(cur[2], p[2]);
          } else {
            cur[2].push(p[2]);
          }
        } else if (s === TEXT) {
          cur[2].push(p[1]);
        } else if (s === ATTR_EQ || s === ATTR_BREAK) ; else {
          throw new Error('unhandled: ' + s)
        }
      }

      if (tree[2].length > 1 && /^\s*$/.test(tree[2][0])) {
        tree[2].shift();
      }

      if (tree[2].length > 2
      || (tree[2].length === 2 && /\S/.test(tree[2][1]))) {
        if (opts.createFragment) return opts.createFragment(tree[2])
        throw new Error(
          'multiple root elements must be wrapped in an enclosing tag'
        )
      }
      if (Array.isArray(tree[2][0]) && typeof tree[2][0][0] === 'string'
      && Array.isArray(tree[2][0][2])) {
        tree[2][0] = h(tree[2][0][0], tree[2][0][1], tree[2][0][2]);
      }
      return tree[2][0]

      function parse (str) {
        var res = [];
        if (state === ATTR_VALUE_W) state = ATTR;
        for (var i = 0; i < str.length; i++) {
          var c = str.charAt(i);
          if (state === TEXT && c === '<') {
            if (reg.length) res.push([TEXT, reg]);
            reg = '';
            state = OPEN;
          } else if (c === '>' && !quot(state) && state !== COMMENT) {
            if (state === OPEN && reg.length) {
              res.push([OPEN,reg]);
            } else if (state === ATTR_KEY) {
              res.push([ATTR_KEY,reg]);
            } else if (state === ATTR_VALUE && reg.length) {
              res.push([ATTR_VALUE,reg]);
            }
            res.push([CLOSE]);
            reg = '';
            state = TEXT;
          } else if (state === COMMENT && /-$/.test(reg) && c === '-') {
            if (opts.comments) {
              res.push([ATTR_VALUE,reg.substr(0, reg.length - 1)]);
            }
            reg = '';
            state = TEXT;
          } else if (state === OPEN && /^!--$/.test(reg)) {
            if (opts.comments) {
              res.push([OPEN, reg],[ATTR_KEY,'comment'],[ATTR_EQ]);
            }
            reg = c;
            state = COMMENT;
          } else if (state === TEXT || state === COMMENT) {
            reg += c;
          } else if (state === OPEN && c === '/' && reg.length) ; else if (state === OPEN && /\s/.test(c)) {
            if (reg.length) {
              res.push([OPEN, reg]);
            }
            reg = '';
            state = ATTR;
          } else if (state === OPEN) {
            reg += c;
          } else if (state === ATTR && /[^\s"'=/]/.test(c)) {
            state = ATTR_KEY;
            reg = c;
          } else if (state === ATTR && /\s/.test(c)) {
            if (reg.length) res.push([ATTR_KEY,reg]);
            res.push([ATTR_BREAK]);
          } else if (state === ATTR_KEY && /\s/.test(c)) {
            res.push([ATTR_KEY,reg]);
            reg = '';
            state = ATTR_KEY_W;
          } else if (state === ATTR_KEY && c === '=') {
            res.push([ATTR_KEY,reg],[ATTR_EQ]);
            reg = '';
            state = ATTR_VALUE_W;
          } else if (state === ATTR_KEY) {
            reg += c;
          } else if ((state === ATTR_KEY_W || state === ATTR) && c === '=') {
            res.push([ATTR_EQ]);
            state = ATTR_VALUE_W;
          } else if ((state === ATTR_KEY_W || state === ATTR) && !/\s/.test(c)) {
            res.push([ATTR_BREAK]);
            if (/[\w-]/.test(c)) {
              reg += c;
              state = ATTR_KEY;
            } else state = ATTR;
          } else if (state === ATTR_VALUE_W && c === '"') {
            state = ATTR_VALUE_DQ;
          } else if (state === ATTR_VALUE_W && c === "'") {
            state = ATTR_VALUE_SQ;
          } else if (state === ATTR_VALUE_DQ && c === '"') {
            res.push([ATTR_VALUE,reg],[ATTR_BREAK]);
            reg = '';
            state = ATTR;
          } else if (state === ATTR_VALUE_SQ && c === "'") {
            res.push([ATTR_VALUE,reg],[ATTR_BREAK]);
            reg = '';
            state = ATTR;
          } else if (state === ATTR_VALUE_W && !/\s/.test(c)) {
            state = ATTR_VALUE;
            i--;
          } else if (state === ATTR_VALUE && /\s/.test(c)) {
            res.push([ATTR_VALUE,reg],[ATTR_BREAK]);
            reg = '';
            state = ATTR;
          } else if (state === ATTR_VALUE || state === ATTR_VALUE_SQ
          || state === ATTR_VALUE_DQ) {
            reg += c;
          }
        }
        if (state === TEXT && reg.length) {
          res.push([TEXT,reg]);
          reg = '';
        } else if (state === ATTR_VALUE && reg.length) {
          res.push([ATTR_VALUE,reg]);
          reg = '';
        } else if (state === ATTR_VALUE_DQ && reg.length) {
          res.push([ATTR_VALUE,reg]);
          reg = '';
        } else if (state === ATTR_VALUE_SQ && reg.length) {
          res.push([ATTR_VALUE,reg]);
          reg = '';
        } else if (state === ATTR_KEY) {
          res.push([ATTR_KEY,reg]);
          reg = '';
        }
        return res
      }
    }

    function strfn (x) {
      if (typeof x === 'function') return x
      else if (typeof x === 'string') return x
      else if (x && typeof x === 'object') return x
      else if (x === null || x === undefined) return x
      else return concat('', x)
    }
  };

  function quot (state) {
    return state === ATTR_VALUE_SQ || state === ATTR_VALUE_DQ
  }

  var closeRE = RegExp('^(' + [
    'area', 'base', 'basefont', 'bgsound', 'br', 'col', 'command', 'embed',
    'frame', 'hr', 'img', 'input', 'isindex', 'keygen', 'link', 'meta', 'param',
    'source', 'track', 'wbr', '!--',
    // SVG TAGS
    'animate', 'animateTransform', 'circle', 'cursor', 'desc', 'ellipse',
    'feBlend', 'feColorMatrix', 'feComposite',
    'feConvolveMatrix', 'feDiffuseLighting', 'feDisplacementMap',
    'feDistantLight', 'feFlood', 'feFuncA', 'feFuncB', 'feFuncG', 'feFuncR',
    'feGaussianBlur', 'feImage', 'feMergeNode', 'feMorphology',
    'feOffset', 'fePointLight', 'feSpecularLighting', 'feSpotLight', 'feTile',
    'feTurbulence', 'font-face-format', 'font-face-name', 'font-face-uri',
    'glyph', 'glyphRef', 'hkern', 'image', 'line', 'missing-glyph', 'mpath',
    'path', 'polygon', 'polyline', 'rect', 'set', 'stop', 'tref', 'use', 'view',
    'vkern'
  ].join('|') + ')(?:[\.#][a-zA-Z0-9\u007F-\uFFFF_:-]+)*$');
  function selfClosing (tag) { return closeRE.test(tag) }

  var trailingNewlineRegex = /\n[\s]+$/;
  var leadingNewlineRegex = /^\n[\s]+/;
  var trailingSpaceRegex = /[\s]+$/;
  var leadingSpaceRegex = /^[\s]+/;
  var multiSpaceRegex = /[\n\s]+/g;

  var TEXT_TAGS = [
    'a', 'abbr', 'b', 'bdi', 'bdo', 'br', 'cite', 'data', 'dfn', 'em', 'i',
    'kbd', 'mark', 'q', 'rp', 'rt', 'rtc', 'ruby', 's', 'amp', 'small', 'span',
    'strong', 'sub', 'sup', 'time', 'u', 'var', 'wbr'
  ];

  var VERBATIM_TAGS = [
    'code', 'pre', 'textarea'
  ];

  var appendChild = function appendChild (el, childs) {
    if (!Array.isArray(childs)) return

    var nodeName = el.nodeName.toLowerCase();

    var hadText = false;
    var value, leader;

    for (var i = 0, len = childs.length; i < len; i++) {
      var node = childs[i];
      if (Array.isArray(node)) {
        appendChild(el, node);
        continue
      }

      if (typeof node === 'number' ||
        typeof node === 'boolean' ||
        typeof node === 'function' ||
        node instanceof Date ||
        node instanceof RegExp) {
        node = node.toString();
      }

      var lastChild = el.childNodes[el.childNodes.length - 1];

      // Iterate over text nodes
      if (typeof node === 'string') {
        hadText = true;

        // If we already had text, append to the existing text
        if (lastChild && lastChild.nodeName === '#text') {
          lastChild.nodeValue += node;

        // We didn't have a text node yet, create one
        } else {
          node = el.ownerDocument.createTextNode(node);
          el.appendChild(node);
          lastChild = node;
        }

        // If this is the last of the child nodes, make sure we close it out
        // right
        if (i === len - 1) {
          hadText = false;
          // Trim the child text nodes if the current node isn't a
          // node where whitespace matters.
          if (TEXT_TAGS.indexOf(nodeName) === -1 &&
            VERBATIM_TAGS.indexOf(nodeName) === -1) {
            value = lastChild.nodeValue
              .replace(leadingNewlineRegex, '')
              .replace(trailingSpaceRegex, '')
              .replace(trailingNewlineRegex, '')
              .replace(multiSpaceRegex, ' ');
            if (value === '') {
              el.removeChild(lastChild);
            } else {
              lastChild.nodeValue = value;
            }
          } else if (VERBATIM_TAGS.indexOf(nodeName) === -1) {
            // The very first node in the list should not have leading
            // whitespace. Sibling text nodes should have whitespace if there
            // was any.
            leader = i === 0 ? '' : ' ';
            value = lastChild.nodeValue
              .replace(leadingNewlineRegex, leader)
              .replace(leadingSpaceRegex, ' ')
              .replace(trailingSpaceRegex, '')
              .replace(trailingNewlineRegex, '')
              .replace(multiSpaceRegex, ' ');
            lastChild.nodeValue = value;
          }
        }

      // Iterate over DOM nodes
      } else if (node && node.nodeType) {
        // If the last node was a text node, make sure it is properly closed out
        if (hadText) {
          hadText = false;

          // Trim the child text nodes if the current node isn't a
          // text node or a code node
          if (TEXT_TAGS.indexOf(nodeName) === -1 &&
            VERBATIM_TAGS.indexOf(nodeName) === -1) {
            value = lastChild.nodeValue
              .replace(leadingNewlineRegex, '')
              .replace(trailingNewlineRegex, ' ')
              .replace(multiSpaceRegex, ' ');

            // Remove empty text nodes, append otherwise
            if (value === '') {
              el.removeChild(lastChild);
            } else {
              lastChild.nodeValue = value;
            }
          // Trim the child nodes but preserve the appropriate whitespace
          } else if (VERBATIM_TAGS.indexOf(nodeName) === -1) {
            value = lastChild.nodeValue
              .replace(leadingSpaceRegex, ' ')
              .replace(leadingNewlineRegex, '')
              .replace(trailingNewlineRegex, ' ')
              .replace(multiSpaceRegex, ' ');
            lastChild.nodeValue = value;
          }
        }

        // Store the last nodename
        var _nodeName = node.nodeName;
        if (_nodeName) nodeName = _nodeName.toLowerCase();

        // Append the node to the DOM
        el.appendChild(node);
      }
    }
  };

  var svgTags = [
    'svg', 'altGlyph', 'altGlyphDef', 'altGlyphItem', 'animate', 'animateColor',
    'animateMotion', 'animateTransform', 'circle', 'clipPath', 'color-profile',
    'cursor', 'defs', 'desc', 'ellipse', 'feBlend', 'feColorMatrix',
    'feComponentTransfer', 'feComposite', 'feConvolveMatrix',
    'feDiffuseLighting', 'feDisplacementMap', 'feDistantLight', 'feFlood',
    'feFuncA', 'feFuncB', 'feFuncG', 'feFuncR', 'feGaussianBlur', 'feImage',
    'feMerge', 'feMergeNode', 'feMorphology', 'feOffset', 'fePointLight',
    'feSpecularLighting', 'feSpotLight', 'feTile', 'feTurbulence', 'filter',
    'font', 'font-face', 'font-face-format', 'font-face-name', 'font-face-src',
    'font-face-uri', 'foreignObject', 'g', 'glyph', 'glyphRef', 'hkern', 'image',
    'line', 'linearGradient', 'marker', 'mask', 'metadata', 'missing-glyph',
    'mpath', 'path', 'pattern', 'polygon', 'polyline', 'radialGradient', 'rect',
    'set', 'stop', 'switch', 'symbol', 'text', 'textPath', 'title', 'tref',
    'tspan', 'use', 'view', 'vkern'
  ];

  var boolProps = [
    'async', 'autofocus', 'autoplay', 'checked', 'controls', 'default',
    'defaultchecked', 'defer', 'disabled', 'formnovalidate', 'hidden',
    'ismap', 'loop', 'multiple', 'muted', 'novalidate', 'open', 'playsinline',
    'readonly', 'required', 'reversed', 'selected'
  ];

  var directProps = [
    'indeterminate'
  ];

  // Props that need to be set directly rather than with el.setAttribute()


  var SVGNS = 'http://www.w3.org/2000/svg';
  var XLINKNS = 'http://www.w3.org/1999/xlink';

  var COMMENT_TAG = '!--';

  var dom = function (document) {
    function nanoHtmlCreateElement (tag, props, children) {
      var el;

      // If an svg tag, it needs a namespace
      if (svgTags.indexOf(tag) !== -1) {
        props.namespace = SVGNS;
      }

      // If we are using a namespace
      var ns = false;
      if (props.namespace) {
        ns = props.namespace;
        delete props.namespace;
      }

      // If we are extending a builtin element
      var isCustomElement = false;
      if (props.is) {
        isCustomElement = props.is;
        delete props.is;
      }

      // Create the element
      if (ns) {
        if (isCustomElement) {
          el = document.createElementNS(ns, tag, { is: isCustomElement });
        } else {
          el = document.createElementNS(ns, tag);
        }
      } else if (tag === COMMENT_TAG) {
        return document.createComment(props.comment)
      } else if (isCustomElement) {
        el = document.createElement(tag, { is: isCustomElement });
      } else {
        el = document.createElement(tag);
      }

      // Create the properties
      for (var p in props) {
        if (props.hasOwnProperty(p)) {
          var key = p.toLowerCase();
          var val = props[p];
          // Normalize className
          if (key === 'classname') {
            key = 'class';
            p = 'class';
          }
          // The for attribute gets transformed to htmlFor, but we just set as for
          if (p === 'htmlFor') {
            p = 'for';
          }
          // If a property is boolean, set itself to the key
          if (boolProps.indexOf(key) !== -1) {
            if (String(val) === 'true') val = key;
            else if (String(val) === 'false') continue
          }
          // If a property prefers being set directly vs setAttribute
          if (key.slice(0, 2) === 'on' || directProps.indexOf(key) !== -1) {
            el[p] = val;
          } else {
            if (ns) {
              if (p === 'xlink:href') {
                el.setAttributeNS(XLINKNS, p, val);
              } else if (/^xmlns($|:)/i.test(p)) ; else {
                el.setAttributeNS(null, p, val);
              }
            } else {
              el.setAttribute(p, val);
            }
          }
        }
      }

      appendChild(el, children);
      return el
    }

    function createFragment (nodes) {
      var fragment = document.createDocumentFragment();
      for (var i = 0; i < nodes.length; i++) {
        if (nodes[i] == null) continue
        if (Array.isArray(nodes[i])) {
          fragment.appendChild(createFragment(nodes[i]));
        } else {
          if (typeof nodes[i] === 'string') nodes[i] = document.createTextNode(nodes[i]);
          fragment.appendChild(nodes[i]);
        }
      }
      return fragment
    }

    var exports = hyperx(nanoHtmlCreateElement, {
      comments: true,
      createFragment: createFragment
    });
    exports.default = exports;
    exports.createComment = nanoHtmlCreateElement;
    return exports
  };

  var browser = dom(document);

  var nanohtmlEs6 = browser;

  /**
   * The Ease class provides a collection of easing functions for use with tween.js.
   */
  var Easing = {
      Linear: {
          None: function (amount) {
              return amount;
          },
      },
      Quadratic: {
          In: function (amount) {
              return amount * amount;
          },
          Out: function (amount) {
              return amount * (2 - amount);
          },
          InOut: function (amount) {
              if ((amount *= 2) < 1) {
                  return 0.5 * amount * amount;
              }
              return -0.5 * (--amount * (amount - 2) - 1);
          },
      },
      Cubic: {
          In: function (amount) {
              return amount * amount * amount;
          },
          Out: function (amount) {
              return --amount * amount * amount + 1;
          },
          InOut: function (amount) {
              if ((amount *= 2) < 1) {
                  return 0.5 * amount * amount * amount;
              }
              return 0.5 * ((amount -= 2) * amount * amount + 2);
          },
      },
      Quartic: {
          In: function (amount) {
              return amount * amount * amount * amount;
          },
          Out: function (amount) {
              return 1 - --amount * amount * amount * amount;
          },
          InOut: function (amount) {
              if ((amount *= 2) < 1) {
                  return 0.5 * amount * amount * amount * amount;
              }
              return -0.5 * ((amount -= 2) * amount * amount * amount - 2);
          },
      },
      Quintic: {
          In: function (amount) {
              return amount * amount * amount * amount * amount;
          },
          Out: function (amount) {
              return --amount * amount * amount * amount * amount + 1;
          },
          InOut: function (amount) {
              if ((amount *= 2) < 1) {
                  return 0.5 * amount * amount * amount * amount * amount;
              }
              return 0.5 * ((amount -= 2) * amount * amount * amount * amount + 2);
          },
      },
      Sinusoidal: {
          In: function (amount) {
              return 1 - Math.cos((amount * Math.PI) / 2);
          },
          Out: function (amount) {
              return Math.sin((amount * Math.PI) / 2);
          },
          InOut: function (amount) {
              return 0.5 * (1 - Math.cos(Math.PI * amount));
          },
      },
      Exponential: {
          In: function (amount) {
              return amount === 0 ? 0 : Math.pow(1024, amount - 1);
          },
          Out: function (amount) {
              return amount === 1 ? 1 : 1 - Math.pow(2, -10 * amount);
          },
          InOut: function (amount) {
              if (amount === 0) {
                  return 0;
              }
              if (amount === 1) {
                  return 1;
              }
              if ((amount *= 2) < 1) {
                  return 0.5 * Math.pow(1024, amount - 1);
              }
              return 0.5 * (-Math.pow(2, -10 * (amount - 1)) + 2);
          },
      },
      Circular: {
          In: function (amount) {
              return 1 - Math.sqrt(1 - amount * amount);
          },
          Out: function (amount) {
              return Math.sqrt(1 - --amount * amount);
          },
          InOut: function (amount) {
              if ((amount *= 2) < 1) {
                  return -0.5 * (Math.sqrt(1 - amount * amount) - 1);
              }
              return 0.5 * (Math.sqrt(1 - (amount -= 2) * amount) + 1);
          },
      },
      Elastic: {
          In: function (amount) {
              if (amount === 0) {
                  return 0;
              }
              if (amount === 1) {
                  return 1;
              }
              return -Math.pow(2, 10 * (amount - 1)) * Math.sin((amount - 1.1) * 5 * Math.PI);
          },
          Out: function (amount) {
              if (amount === 0) {
                  return 0;
              }
              if (amount === 1) {
                  return 1;
              }
              return Math.pow(2, -10 * amount) * Math.sin((amount - 0.1) * 5 * Math.PI) + 1;
          },
          InOut: function (amount) {
              if (amount === 0) {
                  return 0;
              }
              if (amount === 1) {
                  return 1;
              }
              amount *= 2;
              if (amount < 1) {
                  return -0.5 * Math.pow(2, 10 * (amount - 1)) * Math.sin((amount - 1.1) * 5 * Math.PI);
              }
              return 0.5 * Math.pow(2, -10 * (amount - 1)) * Math.sin((amount - 1.1) * 5 * Math.PI) + 1;
          },
      },
      Back: {
          In: function (amount) {
              var s = 1.70158;
              return amount * amount * ((s + 1) * amount - s);
          },
          Out: function (amount) {
              var s = 1.70158;
              return --amount * amount * ((s + 1) * amount + s) + 1;
          },
          InOut: function (amount) {
              var s = 1.70158 * 1.525;
              if ((amount *= 2) < 1) {
                  return 0.5 * (amount * amount * ((s + 1) * amount - s));
              }
              return 0.5 * ((amount -= 2) * amount * ((s + 1) * amount + s) + 2);
          },
      },
      Bounce: {
          In: function (amount) {
              return 1 - Easing.Bounce.Out(1 - amount);
          },
          Out: function (amount) {
              if (amount < 1 / 2.75) {
                  return 7.5625 * amount * amount;
              }
              else if (amount < 2 / 2.75) {
                  return 7.5625 * (amount -= 1.5 / 2.75) * amount + 0.75;
              }
              else if (amount < 2.5 / 2.75) {
                  return 7.5625 * (amount -= 2.25 / 2.75) * amount + 0.9375;
              }
              else {
                  return 7.5625 * (amount -= 2.625 / 2.75) * amount + 0.984375;
              }
          },
          InOut: function (amount) {
              if (amount < 0.5) {
                  return Easing.Bounce.In(amount * 2) * 0.5;
              }
              return Easing.Bounce.Out(amount * 2 - 1) * 0.5 + 0.5;
          },
      },
  };

  var now;
  // Include a performance.now polyfill.
  // In node.js, use process.hrtime.
  // eslint-disable-next-line
  // @ts-ignore
  if (typeof self === 'undefined' && typeof process !== 'undefined' && process.hrtime) {
      now = function () {
          // eslint-disable-next-line
          // @ts-ignore
          var time = process.hrtime();
          // Convert [seconds, nanoseconds] to milliseconds.
          return time[0] * 1000 + time[1] / 1000000;
      };
  }
  // In a browser, use self.performance.now if it is available.
  else if (typeof self !== 'undefined' && self.performance !== undefined && self.performance.now !== undefined) {
      // This must be bound, because directly assigning this function
      // leads to an invocation exception in Chrome.
      now = self.performance.now.bind(self.performance);
  }
  // Use Date.now if it is available.
  else if (Date.now !== undefined) {
      now = Date.now;
  }
  // Otherwise, use 'new Date().getTime()'.
  else {
      now = function () {
          return new Date().getTime();
      };
  }
  var now$1 = now;

  /**
   * Controlling groups of tweens
   *
   * Using the TWEEN singleton to manage your tweens can cause issues in large apps with many components.
   * In these cases, you may want to create your own smaller groups of tween
   */
  var Group = /** @class */ (function () {
      function Group() {
          this._tweens = {};
          this._tweensAddedDuringUpdate = {};
      }
      Group.prototype.getAll = function () {
          var _this = this;
          return Object.keys(this._tweens).map(function (tweenId) {
              return _this._tweens[tweenId];
          });
      };
      Group.prototype.removeAll = function () {
          this._tweens = {};
      };
      Group.prototype.add = function (tween) {
          this._tweens[tween.getId()] = tween;
          this._tweensAddedDuringUpdate[tween.getId()] = tween;
      };
      Group.prototype.remove = function (tween) {
          delete this._tweens[tween.getId()];
          delete this._tweensAddedDuringUpdate[tween.getId()];
      };
      Group.prototype.update = function (time, preserve) {
          if (time === void 0) { time = now$1(); }
          if (preserve === void 0) { preserve = false; }
          var tweenIds = Object.keys(this._tweens);
          if (tweenIds.length === 0) {
              return false;
          }
          // Tweens are updated in "batches". If you add a new tween during an
          // update, then the new tween will be updated in the next batch.
          // If you remove a tween during an update, it may or may not be updated.
          // However, if the removed tween was added during the current batch,
          // then it will not be updated.
          while (tweenIds.length > 0) {
              this._tweensAddedDuringUpdate = {};
              for (var i = 0; i < tweenIds.length; i++) {
                  var tween = this._tweens[tweenIds[i]];
                  var autoStart = !preserve;
                  if (tween && tween.update(time, autoStart) === false && !preserve) {
                      delete this._tweens[tweenIds[i]];
                  }
              }
              tweenIds = Object.keys(this._tweensAddedDuringUpdate);
          }
          return true;
      };
      return Group;
  }());

  /**
   *
   */
  var Interpolation = {
      Linear: function (v, k) {
          var m = v.length - 1;
          var f = m * k;
          var i = Math.floor(f);
          var fn = Interpolation.Utils.Linear;
          if (k < 0) {
              return fn(v[0], v[1], f);
          }
          if (k > 1) {
              return fn(v[m], v[m - 1], m - f);
          }
          return fn(v[i], v[i + 1 > m ? m : i + 1], f - i);
      },
      Bezier: function (v, k) {
          var b = 0;
          var n = v.length - 1;
          var pw = Math.pow;
          var bn = Interpolation.Utils.Bernstein;
          for (var i = 0; i <= n; i++) {
              b += pw(1 - k, n - i) * pw(k, i) * v[i] * bn(n, i);
          }
          return b;
      },
      CatmullRom: function (v, k) {
          var m = v.length - 1;
          var f = m * k;
          var i = Math.floor(f);
          var fn = Interpolation.Utils.CatmullRom;
          if (v[0] === v[m]) {
              if (k < 0) {
                  i = Math.floor((f = m * (1 + k)));
              }
              return fn(v[(i - 1 + m) % m], v[i], v[(i + 1) % m], v[(i + 2) % m], f - i);
          }
          else {
              if (k < 0) {
                  return v[0] - (fn(v[0], v[0], v[1], v[1], -f) - v[0]);
              }
              if (k > 1) {
                  return v[m] - (fn(v[m], v[m], v[m - 1], v[m - 1], f - m) - v[m]);
              }
              return fn(v[i ? i - 1 : 0], v[i], v[m < i + 1 ? m : i + 1], v[m < i + 2 ? m : i + 2], f - i);
          }
      },
      Utils: {
          Linear: function (p0, p1, t) {
              return (p1 - p0) * t + p0;
          },
          Bernstein: function (n, i) {
              var fc = Interpolation.Utils.Factorial;
              return fc(n) / fc(i) / fc(n - i);
          },
          Factorial: (function () {
              var a = [1];
              return function (n) {
                  var s = 1;
                  if (a[n]) {
                      return a[n];
                  }
                  for (var i = n; i > 1; i--) {
                      s *= i;
                  }
                  a[n] = s;
                  return s;
              };
          })(),
          CatmullRom: function (p0, p1, p2, p3, t) {
              var v0 = (p2 - p0) * 0.5;
              var v1 = (p3 - p1) * 0.5;
              var t2 = t * t;
              var t3 = t * t2;
              return (2 * p1 - 2 * p2 + v0 + v1) * t3 + (-3 * p1 + 3 * p2 - 2 * v0 - v1) * t2 + v0 * t + p1;
          },
      },
  };

  /**
   * Utils
   */
  var Sequence = /** @class */ (function () {
      function Sequence() {
      }
      Sequence.nextId = function () {
          return Sequence._nextId++;
      };
      Sequence._nextId = 0;
      return Sequence;
  }());

  var mainGroup = new Group();

  /**
   * Tween.js - Licensed under the MIT license
   * https://github.com/tweenjs/tween.js
   * ----------------------------------------------
   *
   * See https://github.com/tweenjs/tween.js/graphs/contributors for the full list of contributors.
   * Thank you all, you're awesome!
   */
  var Tween = /** @class */ (function () {
      function Tween(_object, _group) {
          if (_group === void 0) { _group = mainGroup; }
          this._object = _object;
          this._group = _group;
          this._isPaused = false;
          this._pauseStart = 0;
          this._valuesStart = {};
          this._valuesEnd = {};
          this._valuesStartRepeat = {};
          this._duration = 1000;
          this._initialRepeat = 0;
          this._repeat = 0;
          this._yoyo = false;
          this._isPlaying = false;
          this._reversed = false;
          this._delayTime = 0;
          this._startTime = 0;
          this._easingFunction = Easing.Linear.None;
          this._interpolationFunction = Interpolation.Linear;
          this._chainedTweens = [];
          this._onStartCallbackFired = false;
          this._id = Sequence.nextId();
          this._isChainStopped = false;
          this._goToEnd = false;
      }
      Tween.prototype.getId = function () {
          return this._id;
      };
      Tween.prototype.isPlaying = function () {
          return this._isPlaying;
      };
      Tween.prototype.isPaused = function () {
          return this._isPaused;
      };
      Tween.prototype.to = function (properties, duration) {
          // TODO? restore this, then update the 07_dynamic_to example to set fox
          // tween's to on each update. That way the behavior is opt-in (there's
          // currently no opt-out).
          // for (const prop in properties) this._valuesEnd[prop] = properties[prop]
          this._valuesEnd = Object.create(properties);
          if (duration !== undefined) {
              this._duration = duration;
          }
          return this;
      };
      Tween.prototype.duration = function (d) {
          this._duration = d;
          return this;
      };
      Tween.prototype.start = function (time) {
          if (this._isPlaying) {
              return this;
          }
          // eslint-disable-next-line
          this._group && this._group.add(this);
          this._repeat = this._initialRepeat;
          if (this._reversed) {
              // If we were reversed (f.e. using the yoyo feature) then we need to
              // flip the tween direction back to forward.
              this._reversed = false;
              for (var property in this._valuesStartRepeat) {
                  this._swapEndStartRepeatValues(property);
                  this._valuesStart[property] = this._valuesStartRepeat[property];
              }
          }
          this._isPlaying = true;
          this._isPaused = false;
          this._onStartCallbackFired = false;
          this._isChainStopped = false;
          this._startTime = time !== undefined ? (typeof time === 'string' ? now$1() + parseFloat(time) : time) : now$1();
          this._startTime += this._delayTime;
          this._setupProperties(this._object, this._valuesStart, this._valuesEnd, this._valuesStartRepeat);
          return this;
      };
      Tween.prototype._setupProperties = function (_object, _valuesStart, _valuesEnd, _valuesStartRepeat) {
          for (var property in _valuesEnd) {
              var startValue = _object[property];
              var startValueIsArray = Array.isArray(startValue);
              var propType = startValueIsArray ? 'array' : typeof startValue;
              var isInterpolationList = !startValueIsArray && Array.isArray(_valuesEnd[property]);
              // If `to()` specifies a property that doesn't exist in the source object,
              // we should not set that property in the object
              if (propType === 'undefined' || propType === 'function') {
                  continue;
              }
              // Check if an Array was provided as property value
              if (isInterpolationList) {
                  var endValues = _valuesEnd[property];
                  if (endValues.length === 0) {
                      continue;
                  }
                  // handle an array of relative values
                  endValues = endValues.map(this._handleRelativeValue.bind(this, startValue));
                  // Create a local copy of the Array with the start value at the front
                  _valuesEnd[property] = [startValue].concat(endValues);
              }
              // handle the deepness of the values
              if ((propType === 'object' || startValueIsArray) && startValue && !isInterpolationList) {
                  _valuesStart[property] = startValueIsArray ? [] : {};
                  // eslint-disable-next-line
                  for (var prop in startValue) {
                      // eslint-disable-next-line
                      // @ts-ignore FIXME?
                      _valuesStart[property][prop] = startValue[prop];
                  }
                  _valuesStartRepeat[property] = startValueIsArray ? [] : {}; // TODO? repeat nested values? And yoyo? And array values?
                  // eslint-disable-next-line
                  // @ts-ignore FIXME?
                  this._setupProperties(startValue, _valuesStart[property], _valuesEnd[property], _valuesStartRepeat[property]);
              }
              else {
                  // Save the starting value, but only once.
                  if (typeof _valuesStart[property] === 'undefined') {
                      _valuesStart[property] = startValue;
                  }
                  if (!startValueIsArray) {
                      // eslint-disable-next-line
                      // @ts-ignore FIXME?
                      _valuesStart[property] *= 1.0; // Ensures we're using numbers, not strings
                  }
                  if (isInterpolationList) {
                      // eslint-disable-next-line
                      // @ts-ignore FIXME?
                      _valuesStartRepeat[property] = _valuesEnd[property].slice().reverse();
                  }
                  else {
                      _valuesStartRepeat[property] = _valuesStart[property] || 0;
                  }
              }
          }
      };
      Tween.prototype.stop = function () {
          if (!this._isChainStopped) {
              this._isChainStopped = true;
              this.stopChainedTweens();
          }
          if (!this._isPlaying) {
              return this;
          }
          // eslint-disable-next-line
          this._group && this._group.remove(this);
          this._isPlaying = false;
          this._isPaused = false;
          if (this._onStopCallback) {
              this._onStopCallback(this._object);
          }
          return this;
      };
      Tween.prototype.end = function () {
          this._goToEnd = true;
          this.update(Infinity);
          return this;
      };
      Tween.prototype.pause = function (time) {
          if (time === void 0) { time = now$1(); }
          if (this._isPaused || !this._isPlaying) {
              return this;
          }
          this._isPaused = true;
          this._pauseStart = time;
          // eslint-disable-next-line
          this._group && this._group.remove(this);
          return this;
      };
      Tween.prototype.resume = function (time) {
          if (time === void 0) { time = now$1(); }
          if (!this._isPaused || !this._isPlaying) {
              return this;
          }
          this._isPaused = false;
          this._startTime += time - this._pauseStart;
          this._pauseStart = 0;
          // eslint-disable-next-line
          this._group && this._group.add(this);
          return this;
      };
      Tween.prototype.stopChainedTweens = function () {
          for (var i = 0, numChainedTweens = this._chainedTweens.length; i < numChainedTweens; i++) {
              this._chainedTweens[i].stop();
          }
          return this;
      };
      Tween.prototype.group = function (group) {
          this._group = group;
          return this;
      };
      Tween.prototype.delay = function (amount) {
          this._delayTime = amount;
          return this;
      };
      Tween.prototype.repeat = function (times) {
          this._initialRepeat = times;
          this._repeat = times;
          return this;
      };
      Tween.prototype.repeatDelay = function (amount) {
          this._repeatDelayTime = amount;
          return this;
      };
      Tween.prototype.yoyo = function (yoyo) {
          this._yoyo = yoyo;
          return this;
      };
      Tween.prototype.easing = function (easingFunction) {
          this._easingFunction = easingFunction;
          return this;
      };
      Tween.prototype.interpolation = function (interpolationFunction) {
          this._interpolationFunction = interpolationFunction;
          return this;
      };
      Tween.prototype.chain = function () {
          var tweens = [];
          for (var _i = 0; _i < arguments.length; _i++) {
              tweens[_i] = arguments[_i];
          }
          this._chainedTweens = tweens;
          return this;
      };
      Tween.prototype.onStart = function (callback) {
          this._onStartCallback = callback;
          return this;
      };
      Tween.prototype.onUpdate = function (callback) {
          this._onUpdateCallback = callback;
          return this;
      };
      Tween.prototype.onRepeat = function (callback) {
          this._onRepeatCallback = callback;
          return this;
      };
      Tween.prototype.onComplete = function (callback) {
          this._onCompleteCallback = callback;
          return this;
      };
      Tween.prototype.onStop = function (callback) {
          this._onStopCallback = callback;
          return this;
      };
      /**
       * @returns true if the tween is still playing after the update, false
       * otherwise (calling update on a paused tween still returns true because
       * it is still playing, just paused).
       */
      Tween.prototype.update = function (time, autoStart) {
          if (time === void 0) { time = now$1(); }
          if (autoStart === void 0) { autoStart = true; }
          if (this._isPaused)
              return true;
          var property;
          var elapsed;
          var endTime = this._startTime + this._duration;
          if (!this._goToEnd && !this._isPlaying) {
              if (time > endTime)
                  return false;
              if (autoStart)
                  this.start(time);
          }
          this._goToEnd = false;
          if (time < this._startTime) {
              return true;
          }
          if (this._onStartCallbackFired === false) {
              if (this._onStartCallback) {
                  this._onStartCallback(this._object);
              }
              this._onStartCallbackFired = true;
          }
          elapsed = (time - this._startTime) / this._duration;
          elapsed = this._duration === 0 || elapsed > 1 ? 1 : elapsed;
          var value = this._easingFunction(elapsed);
          // properties transformations
          this._updateProperties(this._object, this._valuesStart, this._valuesEnd, value);
          if (this._onUpdateCallback) {
              this._onUpdateCallback(this._object, elapsed);
          }
          if (elapsed === 1) {
              if (this._repeat > 0) {
                  if (isFinite(this._repeat)) {
                      this._repeat--;
                  }
                  // Reassign starting values, restart by making startTime = now
                  for (property in this._valuesStartRepeat) {
                      if (!this._yoyo && typeof this._valuesEnd[property] === 'string') {
                          this._valuesStartRepeat[property] =
                              // eslint-disable-next-line
                              // @ts-ignore FIXME?
                              this._valuesStartRepeat[property] + parseFloat(this._valuesEnd[property]);
                      }
                      if (this._yoyo) {
                          this._swapEndStartRepeatValues(property);
                      }
                      this._valuesStart[property] = this._valuesStartRepeat[property];
                  }
                  if (this._yoyo) {
                      this._reversed = !this._reversed;
                  }
                  if (this._repeatDelayTime !== undefined) {
                      this._startTime = time + this._repeatDelayTime;
                  }
                  else {
                      this._startTime = time + this._delayTime;
                  }
                  if (this._onRepeatCallback) {
                      this._onRepeatCallback(this._object);
                  }
                  return true;
              }
              else {
                  if (this._onCompleteCallback) {
                      this._onCompleteCallback(this._object);
                  }
                  for (var i = 0, numChainedTweens = this._chainedTweens.length; i < numChainedTweens; i++) {
                      // Make the chained tweens start exactly at the time they should,
                      // even if the `update()` method was called way past the duration of the tween
                      this._chainedTweens[i].start(this._startTime + this._duration);
                  }
                  this._isPlaying = false;
                  return false;
              }
          }
          return true;
      };
      Tween.prototype._updateProperties = function (_object, _valuesStart, _valuesEnd, value) {
          for (var property in _valuesEnd) {
              // Don't update properties that do not exist in the source object
              if (_valuesStart[property] === undefined) {
                  continue;
              }
              var start = _valuesStart[property] || 0;
              var end = _valuesEnd[property];
              var startIsArray = Array.isArray(_object[property]);
              var endIsArray = Array.isArray(end);
              var isInterpolationList = !startIsArray && endIsArray;
              if (isInterpolationList) {
                  _object[property] = this._interpolationFunction(end, value);
              }
              else if (typeof end === 'object' && end) {
                  // eslint-disable-next-line
                  // @ts-ignore FIXME?
                  this._updateProperties(_object[property], start, end, value);
              }
              else {
                  // Parses relative end values with start as base (e.g.: +10, -3)
                  end = this._handleRelativeValue(start, end);
                  // Protect against non numeric properties.
                  if (typeof end === 'number') {
                      // eslint-disable-next-line
                      // @ts-ignore FIXME?
                      _object[property] = start + (end - start) * value;
                  }
              }
          }
      };
      Tween.prototype._handleRelativeValue = function (start, end) {
          if (typeof end !== 'string') {
              return end;
          }
          if (end.charAt(0) === '+' || end.charAt(0) === '-') {
              return start + parseFloat(end);
          }
          else {
              return parseFloat(end);
          }
      };
      Tween.prototype._swapEndStartRepeatValues = function (property) {
          var tmp = this._valuesStartRepeat[property];
          var endValue = this._valuesEnd[property];
          if (typeof endValue === 'string') {
              this._valuesStartRepeat[property] = this._valuesStartRepeat[property] + parseFloat(endValue);
          }
          else {
              this._valuesStartRepeat[property] = this._valuesEnd[property];
          }
          this._valuesEnd[property] = tmp;
      };
      return Tween;
  }());

  var VERSION = '18.6.4';

  /**
   * Tween.js - Licensed under the MIT license
   * https://github.com/tweenjs/tween.js
   * ----------------------------------------------
   *
   * See https://github.com/tweenjs/tween.js/graphs/contributors for the full list of contributors.
   * Thank you all, you're awesome!
   */
  var nextId = Sequence.nextId;
  /**
   * Controlling groups of tweens
   *
   * Using the TWEEN singleton to manage your tweens can cause issues in large apps with many components.
   * In these cases, you may want to create your own smaller groups of tweens.
   */
  var TWEEN = mainGroup;
  // This is the best way to export things in a way that's compatible with both ES
  // Modules and CommonJS, without build hacks, and so as not to break the
  // existing API.
  // https://github.com/rollup/rollup/issues/1961#issuecomment-423037881
  var getAll = TWEEN.getAll.bind(TWEEN);
  var removeAll = TWEEN.removeAll.bind(TWEEN);
  var add = TWEEN.add.bind(TWEEN);
  var remove = TWEEN.remove.bind(TWEEN);
  var update = TWEEN.update.bind(TWEEN);
  var exports$1 = {
      Easing: Easing,
      Group: Group,
      Interpolation: Interpolation,
      now: now$1,
      Sequence: Sequence,
      nextId: nextId,
      Tween: Tween,
      VERSION: VERSION,
      getAll: getAll,
      removeAll: removeAll,
      add: add,
      remove: remove,
      update: update,
  };

  let canvas;
  let ctx;
  let bounds;
  let rootRadius;
  let numDiagramBits = 20;
  let diagramCode;

  let getRootRadius = () => Math.min(canvas.height/2, canvas.width/2);

  function init(canvasEl) {
    canvas = canvasEl;
    ctx = canvas.getContext('2d');
    bounds = canvas.parentElement.getBoundingClientRect();

    canvas.width = 2 * bounds.width;
    canvas.height = 2 * bounds.height;

    rootRadius = getRootRadius();

    if (diagramCodeFromHash()) {
      setDiagramCode(diagramCodeFromHash());
    } else {
      randomize();
    }

    animate();
  }

  let state$1 = window.diagramState = {
    mode: 'explore', // explore | clock
    current: null,
    target: null
  };

  let drawHemisphere = (ctx, x, y, r, side, color, rotation=0, startAngle=0, endAngle=Math.PI) => {
    let anticlockwise = false;
    ctx.translate(Math.floor(canvas.width / 2), Math.floor(canvas.height / 2));
    ctx.translate(x, y);
    ctx.rotate(rotation);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, r, startAngle, endAngle, anticlockwise);
    ctx.lineTo(0, 0);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  };

  let bigHemisphere = (ctx, { side, color, rotation, startAngle=0, endAngle=Math.PI }) => {
    drawHemisphere(ctx, 0, 0, rootRadius, side, color, rotation, startAngle, endAngle);
  };

  let mediumHemisphere = (ctx, { side, color, index, rotation, startAngle=0, endAngle=Math.PI }) => {
    let offset = -rootRadius / 4;
    let x = offset + index * (rootRadius / 2);
    let y = 0;
    let r = 3 * rootRadius / 4;
    drawHemisphere(ctx, x, y, r, side, color, rotation, startAngle, endAngle);
  };

  let smallHemisphere = (ctx, { side, color, index, rotation, startAngle=0, endAngle=Math.PI }) => {
    let offset = -rootRadius / 2;
    let x = offset + index * (rootRadius / 2);
    let y = 0;
    let r = rootRadius / 2;
    drawHemisphere(ctx, x, y, r, side, color, rotation, startAngle, endAngle);
  };

  let tinyHemisphere = (ctx, { side, color, index, rotation, startAngle=0, endAngle=Math.PI }) => {
    let offset = -3 * rootRadius / 4;
    let x = offset + index * (rootRadius / 2);
    let y = 0;
    let r = rootRadius / 4;
    drawHemisphere(ctx, x, y, r, side, color, rotation, startAngle, endAngle);
  };

  let fullCircle = () => ({ startAngle: 0, endAngle: 2*Math.PI });
  let topHalfCircle = () => ({ startAngle: 0, endAngle: Math.PI });
  let bottomHalfCircle = () => ({ startAngle: Math.PI, endAngle: 2*Math.PI });
  let empty = () => ({ startAngle: 0, endAngle: 0 });

  let createTargetState = diagramCode => {
    let singleCircleState = ([top, bottom]) => {
      if (top && bottom) {
        return { white: fullCircle(), black: empty() }
      } else if (top && !bottom) {
        return { white: topHalfCircle(), black: bottomHalfCircle() }
      } else if (!top && bottom) {
        return { white: bottomHalfCircle(), black: topHalfCircle() }
      } else if (!top && !bottom) {
        return { white: empty(), black: fullCircle() }
      }
    };

    return {
      big: [
        singleCircleState(diagramCode.slice(0, 2))
      ],
      medium: [
        singleCircleState(diagramCode.slice(2, 4)),
        singleCircleState(diagramCode.slice(4, 6))
      ],
      small: [
        singleCircleState(diagramCode.slice(6, 8)),
        singleCircleState(diagramCode.slice(8, 10)),
        singleCircleState(diagramCode.slice(10, 12))
      ],
      tiny: [
        singleCircleState(diagramCode.slice(12, 14)),
        singleCircleState(diagramCode.slice(14, 16)),
        singleCircleState(diagramCode.slice(16, 18)),
        singleCircleState(diagramCode.slice(18, 20))
      ]
    }
  };

  function render() {
    let renderBlackCircleState = (fn, index, { startAngle, endAngle }) => {
      let color = 'black';
      let side = 'top';
      let rotation = 0;
      fn(ctx, { side, color, index, rotation, startAngle, endAngle });
    };

    let renderWhiteCircleState = (fn, index, { startAngle, endAngle }) => {
      let color = 'white';
      let side = 'top';
      let rotation = 0;
      fn(ctx, { side, color, index, rotation, startAngle, endAngle });
    };

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    state$1.current.big.forEach((circleState, i) => {
      renderBlackCircleState(bigHemisphere, i, circleState.black);
      renderWhiteCircleState(bigHemisphere, i, circleState.white);
    });

    state$1.current.medium.forEach((circleState, i) => {
      renderBlackCircleState(mediumHemisphere, i, circleState.black);
      renderWhiteCircleState(mediumHemisphere, i, circleState.white);
    });

    state$1.current.small.forEach((circleState, i) => {
      renderBlackCircleState(smallHemisphere, i, circleState.black);
      renderWhiteCircleState(smallHemisphere, i, circleState.white);
    });

    state$1.current.tiny.forEach((circleState, i) => {
      renderBlackCircleState(tinyHemisphere, i, circleState.black);
      renderWhiteCircleState(tinyHemisphere, i, circleState.white);
    });

    // ctx.fillStyle = 'rgb(127, 127, 127)'
    // ctx.fillRect(0, 0, canvas.width, canvas.height)

    // ctx.translate(0, -250)
    // renderBlackCircleState(tinyHemisphere, 3, state.current.tiny[3].black)
    
    // ctx.translate(0, 250)
    // renderWhiteCircleState(tinyHemisphere, 3, state.current.tiny[3].white)
  }

  function animate(time) {
    exports$1.update(time);
    render();
    window.requestAnimationFrame(() => animate());
  }

  // window.addEventListener('keydown', (e) => {
  //   if (e.key === 'Tab') {
  //     e.preventDefault()
  //     if (mode === 'selection') {
  //       mode = 'rotation'
  //     } else {
  //       mode = 'selection'
  //     }
  //   } else if (e.key === 'ArrowLeft') {
  //     setDiagramCodeAsInt(getDiagramCodeAsInt() - 1)
  //   } else if (e.key === 'ArrowRight') {
  //     setDiagramCodeAsInt(getDiagramCodeAsInt() + 1)
  //   } else if (e.key === ' ') {
  //     setDiagramCodeAsInt(Math.floor(Math.random()*Math.pow(2, numDiagramBits)))
  //   } else if (e.key === 'Escape') {
  //     rotationA = 0
  //     rotationB = 0
  //     setDiagramCodeAsInt(0)
  //   } else if (e.key === 's') {
  //     animate()
  //   }
  //   render()
  // })

  // let setMouseXY = (e) => {
  //   // Convert screen location -> diagram encoding
  //   var diagramIndex = d3.scaleLinear()
  //     .domain([0, window.innerWidth * window.innerHeight])
  //     .range([0, Math.pow(2, numDiagramBits)])

  //   if (mode === 'rotation') {
  //     rotationA = e.clientX / window.innerWidth * 2 * Math.PI
  //     rotationB = e.clientY / window.innerHeight * 2 * Math.PI
  //   }

  //   if (mode === 'selection') {
  //     setDiagramCodeAsInt(diagramIndex(e.clientX * e.clientY))
  //   }

  //   render()
  // }

  window.addEventListener('resize', onResize);

  function onResize() {
    let bounds = canvas.parentElement.getBoundingClientRect();
    canvas.width = 2 * bounds.width;
    canvas.height = 2 * bounds.height;
    rootRadius = getRootRadius();
    render();
  }

  // window.addEventListener('popstate', () => {
  //   setDiagramCode(diagramCodeFromHash())
  //   render()
  // })

  function diagramCodeFromHash() {
    if (window.location.hash)
      return window.location.hash.slice(1).split('').map((n) => parseFloat(n))
  }

  function setDiagramCodeAsInt(diagramCodeAsInt) {
    setDiagramCode(diagramCodeFromInt(diagramCodeAsInt));

    // Save state to URL
    // let { protocol, host, pathname } = window.location
    // let newUrl = `${protocol}//${host}${pathname}#${diagramCode.join('')}`
    // window.history.pushState({}, '', newUrl)
  }

  function setDiagramCode(newCode, duration = 1500) {
    diagramCode = newCode;
    let newState = createTargetState(diagramCode);
    setTargetState(newState, duration);
  }

  function setTargetState(newState, duration = 1500, easing = exports$1.Easing.Sinusoidal.Out) {
    state$1.target = newState;

    // init state.current
    if (!state$1.current) {
      // clone the target state
      state$1.current = JSON.parse(JSON.stringify(state$1.target));
    }

    let flattenedCurrentStates = flattenStates(state$1.current);
    let flattenedTargetStates = flattenStates(state$1.target);
    
    flattenedCurrentStates.forEach((state, idx) => {
      new exports$1.Tween(state.black)
        .to({
          startAngle: flattenedTargetStates[idx].black.startAngle,
          endAngle: flattenedTargetStates[idx].black.endAngle
        }, duration)
        .easing(easing)
        .start();

      new exports$1.Tween(state.white)
        .to({
          startAngle: flattenedTargetStates[idx].white.startAngle,
          endAngle: flattenedTargetStates[idx].white.endAngle
        }, duration)
        .easing(easing)
        .start();
    });
  }

  function flattenStates(states) {
    return Object.values(states).reduce((acc, el) => acc.concat(el), [])
  }

  function getHalfAndHalfStates() {
    return state$1.target.tiny.filter(s => {
      return (s.black.endAngle - s.black.startAngle < 6) &&
        (s.black.endAngle - s.black.startAngle > 1)
    })
  }
  window.getHalfAndHalfStates = getHalfAndHalfStates;

  function diagramCodeFromInt(diagramCodeAsInt) {
    function dec2bin(dec){
      return (dec >>> 0).toString(2)
    }

    let diagramBinary = dec2bin(diagramCodeAsInt).split('').map((n) => parseFloat(n));

    // Pad with 0s at the beginning
    while (diagramBinary.length < numDiagramBits) {
      diagramBinary.unshift(0);
    }

    return diagramBinary
  }

  function tickAFewCircles(indices) {
    let halfAndHalfs = getHalfAndHalfStates();
    indices.forEach(index => {
      let state = halfAndHalfs[index];
      state.black.startAngle += Math.PI;
      state.black.endAngle += Math.PI;
      state.white.startAngle += Math.PI;
      state.white.endAngle += Math.PI;
    });
    setTargetState(state$1.target, 5000, exports$1.Easing.Linear.None);
  }
  window.tickAFewCircles = tickAFewCircles;

  function tick(duration = 1500) {
    let now = new Date();
    let nowMillis = now.getTime();
    let intervalSize = 1; // seconds in an interval
    let nowIntervals = nowMillis / 1000 / intervalSize;
    let nowMod = nowIntervals % Math.pow(2, numDiagramBits);
    let code = diagramCodeFromInt(nowMod);
    // debug(`
    //   ${nowMillis / 1000}
    //   <br>
    //   ${nowIntervals}
    // `)
    if (code.join('') !== diagramCode.join('')) {
      setDiagramCode(code, duration);
      render();
    }
  }

  function enterClockMode() {
    state$1.mode = 'clock';
    tickForever();
  }

  function tickForever() {
    tick(800);
    setTimeout(() => tickForever(), 50);
  }

  function randomize() {
    setDiagramCodeAsInt(Math.floor(Math.random()*Math.pow(2, numDiagramBits)));
    render();
  }

  var diagram = {
    init, tick, randomize, canvas, enterClockMode, state: state$1
  };

  var snippets = `// Hey, let's play pretend!

Okay, little one.

Let's pretend we're living in a world without clocks.

And there you are, in bed, nearing the end of a deep, deep sleep.

// Like this?

// zzzZzzz...zzZZzzzzzz....zzzZzzzz zzzzZ..zZzzzzzzZ....zzz....zzzZz.zzzzz

Yes, exactly like that. Well snored, little one.

And now let’s imagine:

It’s a clockless world.

Without tick-tocking or tock-ticking,

what is it that wakes you from your sleep?

Is it the sweet smell-math of yesterday's compost —

— fragrant little shapes hoping to fit snugly inside the comfy caverns of your nostrils?

// Ewww, not my nose!

Okay, okay. Then perhaps you wake because the Sun's rays have arrived for a playdate.

They sneak in through a gap in your curtains —

— and paint themselves in warm golden trapezoids around your room.

They want to play! They send streams of photons, tiny wavelets to jostle you awake —

— like pebbles on a window pane. But instead of making sounds —

— they warm your body with millions of little jiggles —

— until you start to sweat, and you wake up grumpy and moist.

// Naw... I’m not grumpy and moist.

Well then, how about those big, spherical eyeballs of yours?

They’re sensitive to a particular color — a blue, in fact — carried by the Sun's rays.

When your eyes sense enough of this special blue, they send a message to your circadian clock, and—

// HEY! You said no clocks!

Well, yes, but—

// And who's Sir Kadian? You gotta introduce all the characters.

No, no, *circadian* — it’s hardly a clock. It's a name for how living things on Earth keep track of time in their bodies.

// Sounds like a clock to me. You're changing the rules!

Hmm.

I suppose you're right.

But if circadian clocks aren't in play, we're gonna have to let go of a few other things too.

// Like what?

Birthdays, for one.

// WHAT?!

They're just another way to keep track of time. I'm sure you understand.

Also, stars...

// NO!

You betcha. The stars in the sky match up with the day of the year.

If you look close enough, you can even tell exactly what time it is.

Oh and the sun and moon have to go too.

// THE MOON?!

Really any repeating cycle could be used to measure time.

For example, when people say things like —

“It was only *nine moons ago* when your sister Moogus first encountered the tactile squizzle-glorb.”

// I've never heard anyone say that.

But you get the idea.

If it happens over and over again, you can count and measure against it.

We even need to get rid of leaky faucets. Otherwise people would keep track of time in drips.

// “I'll meet you at the biscuit shop in 75 drips.”

Yessss, exactly. Now you're getting the idea.



// I don't know if I like this place anymore.

// I think it would be hard to live here without the moon or the stars or leaky faucets.

Hard, eh? Maybe impossible. We haven't even made it to heartbeats yet.

// Heartbeats?

Yet another pesky primordial clock. We can’t be having any of those.

// But my heartbeat feels like it’s always changing. I hear it thumping when I’m running, but it’s so slow I forget it’s there when I’m reading. That's not a clock.

The motion of the earth and the stars is always changing too!

// Nuh uh! The earth rotates 360 degrees every 24 hours,

// and it takes 365 and a quarter rotations to go around the sun.

// (The quarter is why we have leap years — I learned this all in Astronomics class.) It's as regular as clockwork.

They lied to you.

Every day is *not* 24 hours, and a year is not exactly 365 and a quarter rotations.

It’s all clock propaganda. Clockaganda.

// (⁰ ꓃ ⁰し) 

A day is 24 hours on *average*. But each individual rotation is different by up to 30 seconds.

And that's because of the Earth's elliptical orbit. On top of that, the speed that the Earth spins is always changing.

People never talk about this. It's a global conspiracy.

// ...

// I don't believe you. If that's true, how come clocks work at all?

Because humans put an enormous amount of effort into continuously correcting them.

Clocks and calendars have always been inaccurate, and humans are always working to correct them.

The motion of the earth is just like your heartbeat — always changing, reflecting what's going on in your body at every moment.

Your heart speeds up when you're anxious or flustered, and slows down when you're calm and relaxed.

You've heard of a leap year, yes. But have you heard of a leap second?

Every once in a while a bunch of people nobody has ever heard of decide to add or remove a second from everyone's clocks.

// ???

// Why would they do that? Who are these people?

They call themselves The International Earth Rotation and Reference Systems Service, or IERS for short.

I like to call them “The Big Ears,” because they're always listening to the heartbeat of the Earth.

The Big Ears add seconds to the clock to account for changes in the speed of Earth's rotation.

Sometimes the rotation speed changes because of a rare event, like a big earthquake, or a glacier melting —

— or because someone decided to build a giant dam, changing the distribution of mass around the planet —

// Kind of like when a rollerblader pulls in their arms for a faster spin…?

Exactly. And the rest of the time it’s regular daily life that influences Earth’s rotation —

— like the constant, gentle tug of the Moon on Earth’s tidal swell —

— or the friction of the wind blowing across its oceans and continents —

— or the oceans’ internal turbulence, sloshing around unfathomably large masses of water.

(Even Earth’s molten core has a say, although I hear that’s harder to measure.)

// Jeez Louise!

That’s what it takes to be a planet! It’s not an easy job.

Each of these different motions affects Earth’s heartbeat, and if we didn't adjust our clocks —

— eventually they would drift apart from reality and say it’s 9:00 AM when it’s actually the middle of the night.



// So what's that strange contraption of black and white shifting blobs?

Oh, this?

This is a clock basket.

Try touching it with your finger or mouse pointer.

// It shifts.

Yes, to a random arrangement each time.

I want to show you a trick, but you need to grab some friends.

// Like real-life friends? In person?

Yes. The clock basket has some interesting properties with friends.

Tell your friends to load the clock basket on their own devices.

// Oh. Will they have to go through the entire chat we just had?

No, they can ignore the dialog and focus on the clock basket.

Ask your friends to stand in a circle, so you are all side by side.

Then you're going to count down from FIVE, and on ONE, everyone touches their own clock basket.

// What's going to happen?

I'm not gonna tell you! You have to try it yourself.

// Okay okay okay. I found a friend. We're ready. Here we go:

// 5...

// 4...

// 3...

Oh wait one more thing.

// ... ?

Put your devices in airplane mode.

This way you can be certain that your clock baskets are not communicating with each other.

// Okay. Whatever you say. Here goes.

// 5... 4... 3... 2... 1!

// Woah! That was cool.

What happened?

// The clock baskets look the same!

// Or, almost the same. They all turned into very similar shapes.

Yes!

// But how? How is that possible?

Are you sure you want me to show you?

// Wait, I want to think about it for a bit.

Okay. I'll be here.





// I can't figure it out.

// Airplane mode was on, so no signals were talking to my device...

// How did the clock baskets match up?

One second, let me just make a few adjustments...

Okay. It's ready.

To reveal the secret, touch the clock basket, and leave your finger down for five seconds.

// Oh! Ohhhhhhh.

// It's ticking! Of course!

// “clock” basket. I get it. The secret is that it's actually a clock.

That's right.

// But was it always a clock? Earlier you said it was totally random.

Yes. There's a bit of trickery involved.

At first it was random, but if you let the basket rest for five seconds —

// — 5... 4... 3... 2... 1... —

— it’s programmed so that the next image is generated from the current time.

// A sneaky trick!

// How come my friend's clock basket looks a little different than mine?

That's because the clock in your friend's device is a little bit behind yours.

I've noticed that it's pretty common for device clocks to differ by one or two seconds.

// So does this mean that everyone looking at the clock basket, no matter where in the world, sees the same picture?

Yes! Exactly. That's the coordinating power of clocks. But clocks weren't always this powerful.

The first clocks didn't even have faces! They were loud bells in tall towers that signalled important times of day.

They only had meaning for people who could hear them, so the louder the bell, the more powerful the clock.

// What kinds of things did the old clocks signal?

I'm actually not sure. I think anything that was important to do as a group, like eating and praying, but it probably depended on your culture.

Through a different lens, the power to coordinate is the same as the power to control.

Your nervous system coordinates the extension and contraction of all your muscles —

— it gives you control over the movement of your body.

// This is why I am so good at doing the moonwalk :)

Similarly, the chime of a bell coordinates the actions of community members, like prayer, or lunch, or work —

— it grants the bell-ringer control over the behavior of the community.

// Like when the bell rings at school, and everyone stands up like robots!

Or when it rings at work, and everyone takes a lunch break, or a summer vacation, etc. etc.

Clocks and calendars are very useful tools both for coordination *and* control.

It is no surprise that both French revolutionaries and Soviet revolutionaries, as part of their campaigns for power and liberation, hoped to change the number of days in a week.

Nowadays we use clocks to schedule nearly everything we do. Even the boring stuff, like meetings.

// Especially the boring stuff! Sometimes it feels like most of the important things I do don't need a clock at all.

Like what kinds of things?

// I dunno. Reading a book, going on a bike ride, meditating, hanging out with my friends.

You don’t use a clock to decide on a good time to hang out?

// Not usually. I just go to their house and knock on the door to see if they’re around.

That sounds really nice. I wonder if that’s a generational thing.

One day, a couple of years ago, I scheduled a time to visit my friends Melody and Michael in Santa Fe, New Mexico.

They gave me espresso and cookies, and Michael showed me a big print of a drawing he had made of overlapping circles.

That’s where the design of this clock basket came from.

There are ten circles, and each circle has two halves, which can be either black or white.

There are about a million combinations, and I wanted to show Michael all of them.

I thought I would make a movie that went through all the combinations, but then I found out the movie would take about twelve days to watch!

// That’s like maybe the most boring movie.

That’s what I thought too. And then I figured a boring movie might make a kind of interesting clock...

// And here we are!

And here we are. But not for much longer. I want to get started on the next clock basket! I already have several ideas I want to try out.

// Oooooh. Can I come?

Yes, of course! I couldn’t do it without you.

// Let’s go!

`;

  let pointerDown;
  let pointerUp;
  if ('PointerEvent' in window) {
    pointerDown = 'pointerdown';
    pointerUp = 'pointerup';
  } else {
    pointerDown = 'mousedown';
    pointerUp = 'mouseup';
  }

  let state = {
    lastInteractionTime: null,
    tickThreshold: 5000,
    frameIndex: 0,
    storyMode: false
  };

  async function mountClockBasket(el) {

    // Mount the html
    let clockBasketContainer = nanohtmlEs6`
    <div class="clock-basket-container">
      <div class="canvas-container">
        <div class="canvas-wrap">
          <canvas id="main-canvas"></canvas>  
        </div>
      </div>
      <div class="buttons">
        <a href="#" class="button" onclick=${(e) => beginStory(e)}>Begin</a>
      </div>
    </div>
  `;
    el.appendChild(clockBasketContainer);

    // We move the clock basket into a fixed overlay container when in story mode
    let overlayContainer = nanohtmlEs6`
    <div class="clock-basket-overlay-container">
      <a href="#" class="close-button" onclick=${(e) => closeStory(e)}>✕</a>
      <div class="overlay-canvas-container"></div>
      <div class="story-container">
        <div class="story"></div>
      </div>
    </div>
  `;
    el.parentElement.appendChild(overlayContainer);

    let canvas = document.querySelector('#main-canvas');
    
    diagram.init(canvas);

    function stepDiagram() {
      let now = Date.now();
      
      if (diagram.state.mode === 'explore') {
        if (state.lastInteractionTime && (now - state.lastInteractionTime > state.tickThreshold)) {
          diagram.tick();
        } else {
          diagram.randomize();
        }
      }
      
      state.lastInteractionTime = now;
    }

    let clockBasketStartingPos;
    function enterStoryMode() {
      state.storyMode = true;
      clockBasketStartingPos = window.clockBasketStartingPos = document.querySelector('.canvas-wrap').offsetTop - window.scrollY;
        
      // Insert the clock basket element into the fixed overlay container
      let canvasWrap = document.querySelector('.canvas-wrap');
      let overlayCanvasContainer = document.querySelector('.overlay-canvas-container');
      overlayCanvasContainer.style.width = canvasWrap.offsetWidth + 'px';
      overlayCanvasContainer.prepend(canvasWrap);
      
      // Animate the clock basket to the top of the screen
      let topPadding = 40;
      let coord = { top: clockBasketStartingPos };
      new exports$1.Tween(coord)
        .to({ top: topPadding }, 1000)
        .easing(exports$1.Easing.Sinusoidal.InOut)
        .onUpdate(() => overlayCanvasContainer.style.top = coord.top + 'px')
        .start();
      
      // Set story container position
      document.querySelector('.story-container').style.top = (
        topPadding + canvasWrap.offsetHeight / 2 + Math.min(canvasWrap.offsetWidth, canvasWrap.offsetHeight) / 2 + 'px'
      );

      // Fade in the fixed overlay container
      overlayContainer.classList.add('started');
      document.body.classList.add('no-scroll');
      
      diagram.randomize();
      renderTextFrame(state.frameIndex);
    }

    function beginStory(e) {
      // Prevent <a href="#"> tags from changing the scroll position
      if (e) e.preventDefault();
      
      enterStoryMode();
      history.pushState({ frameIndex: 0 }, '');
    }

    function exitStoryMode() {
      state.storyMode = false;
      let overlayCanvasContainer = document.querySelector('.overlay-canvas-container');
      let canvasContainer = document.querySelector('.canvas-container');
      let canvasWrap = document.querySelector('.canvas-wrap');
      
      // Animate the clock basket to the top of the screen
      let coord = { top: overlayCanvasContainer.offsetTop };
      new exports$1.Tween(coord)
        .to({ top: clockBasketStartingPos }, 1000)
        .easing(exports$1.Easing.Sinusoidal.InOut)
        .onUpdate(() => overlayCanvasContainer.style.top = coord.top + 'px')
        .onComplete(() => canvasContainer.appendChild(canvasWrap))
        .start();

      // Fade out the fixed overlay container
      overlayContainer.classList.remove('started');
      document.body.classList.remove('no-scroll');
      
      diagram.randomize();
      state.frameIndex = 0;
      clearTextFrame();
    }

    function closeStory(e) {
      // Prevent <a href="#"> tags from changing the scroll position
      if (e) e.preventDefault();
      
      exitStoryMode();
      history.pushState({ frameIndex: null }, '');
    }

    let longPressTimeout;
    canvas.addEventListener(pointerDown, (event) => {
      event.preventDefault();
      stepDiagram();
      if (diagram.state.mode === 'explore') {
        clearTimeout(longPressTimeout);
        longPressTimeout = setTimeout(() => diagram.enterClockMode(), 5000);
      }
    });
    document.addEventListener(pointerUp, () => clearTimeout(longPressTimeout));
    document.addEventListener('pointercancel', () => clearTimeout(longPressTimeout));

    function nextFrame(mouseEvent) {
      mouseEvent.stopPropagation();
      stepDiagram();

      let prevIndex = state.frameIndex;
      state.frameIndex += 1;
      renderTextFrame(state.frameIndex, prevIndex);
      
      history.pushState({ frameIndex: state.frameIndex }, '');
    }
    document.querySelector('.story').addEventListener(pointerDown, nextFrame);

    // Parse text snippets
    state.frames = (snippets.split('\n\n').map(s => {
      if (s.startsWith('// ')) {
        return { storyEl: nanohtmlEs6`<div class="snippet voice-2">${s.slice(2)}</div>` }
      } else {
        return { storyEl: nanohtmlEs6`<div class="snippet voice-1">${s}</div>` }
      }
    }));

    window.addEventListener('popstate', (e) => {
      if (e.state && e.state.frameIndex !== null) {
        stepDiagram();
        
        if (!state.storyMode) {
          enterStoryMode();
        }

        let prevIndex = state.frameIndex;
        state.frameIndex = e.state.frameIndex;
        renderTextFrame(state.frameIndex, prevIndex);
      } else {
        exitStoryMode();
      }
    });

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        closeStory();
      }
    });

  }

  function renderTextFrame(index, prevIndex = null) {
    let frame = state.frames[index];

    if (frame.onStart) frame.onStart();
    
    let storyContainer = document.querySelector('.story');

    // Delete the old snippet
    let oldSnippet = document.querySelector('.snippet.outgoing');
    if (oldSnippet) {
      oldSnippet.remove();
    }

    // Animate out the current snippet
    let currentSnippet = document.querySelector('.snippet.incoming');
    if (currentSnippet) {
      currentSnippet.classList.remove('incoming', 'outgoing', 'forward', 'backward');
      if (!prevIndex || prevIndex < index) {
        currentSnippet.classList.add('outgoing', 'forward');
      } else {
        currentSnippet.classList.add('outgoing', 'backward');
      }
    }
    
    // Animate in the new snippet
    frame.storyEl.classList.remove('incoming', 'outgoing', 'forward', 'backward');
    if (!prevIndex || prevIndex < index) {
      frame.storyEl.classList.add('incoming', 'forward');
    } else {
      frame.storyEl.classList.add('incoming', 'backward');
    }
    storyContainer.appendChild(frame.storyEl);  
  }

  function clearTextFrame() {
    let storyContainer = document.querySelector('.story');
    storyContainer.innerHTML = '';
  }

  window.mountClockBasket = mountClockBasket;

  return mountClockBasket;

}());
