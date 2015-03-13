/**
 * @license
 * Copyright (c) 2015 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at http://polymer.github.io/PATENTS.txt
 */

 define('editable/PositionWalker', ['editable'], function(editable) {
   'use strict';

 /**
  * PositionWalker keeps track of a position within a DOM subtree, as a
  * current node and an offset within that node.
  *
  * PositionWalker is similar to NodeIterator with the addition of the
  * offset tracking, the ability to move forward and backward by character
  * position within a node, and the ability to clone.
  *
  * PositionWalker is not as robust to changes in
  * the underlying DOM as NodeIterator, because NodeIterator relies on being
  * able to update its state synchronously when the DOM changes. PositionWalker
  * will require manual notification of DOM changes, an API that's not
  * designed yet.
  */
  return class PositionWalker {

    constructor(node) {
      this.container = node;

      this._containerClone = null;
      this._currentNodeClone = null;
      this._cloneToNodes = null;
      this._nodesToClones = null;

      this.currentNode = node;
      this.localOffset = 0;

      // initialize state to first text position
      this.currentNode = this.getNextNode() || this.currentNode;
      this._makeClone();
    }

    _makeClone() {
      this._containerClone = this.container.cloneNode(true);
      this._cloneToNodes = new WeakMap();
      this._nodesToClones = new WeakMap();

      let iterator = document.createNodeIterator(this.container,
          NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT)
      let cloneIterator = document.createNodeIterator(this._containerClone,
          NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT)

      let n = this.container;
      let c = this._containerClone;

      // find the currentNode's clone
      while (n !== null) {
        if (n === this.currentNode) {
          this._currentNodeClone = c;
        }
        this._cloneToNodes.set(c, n);
        this._nodesToClones.set(n, c);

        n = iterator.nextNode();
        c = cloneIterator.nextNode();
      }
    }

    get isAtBeginning() {
      return (this.localOffset === 0 && this.getPreviousNode() === null);
    }

    get isAtEnd() {
      return (this.currentNode.nodeType !== 3 ||
            this.localOffset === this.currentNode.nodeValue.length) &&
          this.getNextNode() === null;
    }

    getNextNode() {
      let n = this.currentNode;

      if (n.nodeType == 1) { // element
      	if (this.localOffset != 0) {
      		throw "Expected localOffset to be 0, was " + this.localOffset;
      	}
      	if (n.childNodes.length > 0) {
          return n.firstChild;
      	}
      }

      while (n.nextSibling == null && n != this.container) {
        if (n.parentNode == null) {
          throw "parent null for " + n;
        }
      	n = n.parentNode;
      }

      if (n == this.container) {
      	return null;
      }
      return n.nextSibling;
    }

    nextNode() {
      let n = this.currentNode;
      if (n.nodeType == 3) {
        this.localOffset = 0;
      }
      this.currentNode = this.getNextNode() || this.currentNode;
      this._currentNodeClone = this._nodesToClones.get(this.currentNode);
    }

    nextPosition() {
      if (this.isAtEnd) {
        return;
      }

      if (this.currentNode.nodeType == 3 &&
          this.localOffset < this.currentNode.nodeValue.length - 1) {
        this.localOffset++;
        return;
      }

      while (this.currentNode != null) {
        let n = this.getNextNode();
        if (n == null && this.currentNode.nodeType == 3) {
          // normally localOffset is always 0 when we finish a node
          // but for the last text node we want to position at the end
          // of the node instead of the beginning of the next node.
          this.localOffset = this.currentNode.nodeValue.length;
          return;
        } else if (n.nodeType == 3) {
          this.nextNode();
          return;
        }
        this.nextNode();
      }
    }

    getPreviousNode() {
      let n = this.currentNode;

      if (n == this.container) {
        // TODO: just return the container?
        return null;
      }

      if (n.previousSibling != null) {
        // if n has a previousSibling, select the last node in it
        n = n.previousSibling;
        while (n.nodeType != 3 && n.lastChild != null) {
          n = n.lastChild;
        }
        return n;
      } else {
        // if it doesn't, select n's parent
        n = n.parentNode;
        if (n == this.container) {
          return null;
        }
        return n;
      }
    }

    previousNode() {
      let n = this.currentNode;
      if (n.nodeType == 3) {
        this.localOffset = 0;
      }
      this.currentNode = this.getPreviousNode() || this.currentNode;
      this._currentNodeClone = this._nodesToClones.get(this.currentNode);
    }

    previousPosition() {
      if (this.isAtBeginning) {
        return;
      }

      if (this.currentNode.nodeType == 3 && this.localOffset > 0) {
        this.localOffset--;
        return;
      }

      while (this.currentNode != null) {
        let n = this.getPreviousNode();
        if (n != null && n.nodeType == 3) {
          this.localOffset = n.nodeValue.length - 1;
          this.currentNode = n;
          this._currentNodeClone = this._nodesToClones.get(this.currentNode);
          return;
        } else {
          this.currentNode = n;
          this._currentNodeClone = this._nodesToClones.get(this.currentNode);
        }
      }
    }

    clone() {
      let c = new PositionWalker(this.container);
      c.currentNode = this.currentNode;
      c.localOffset = this.localOffset;
      return c;
    }

    getRange() {
      let r = new Range();
      r.setStart(this.currentNode, this.localOffset);
      r.setEnd(this.currentNode, this.localOffset);
      return r;
    }

    getCaretRange() {
      let r = new Range();
      r.setStart(this.currentNode, this.localOffset);
      let endOffset = this.localOffset;
      if (this.currentNode.nodeType == 3 &&
          this.localOffset < this.currentNode.nodeValue.length) {
        endOffset = this.localOffset + 1;
      }
      r.setEnd(this.currentNode, endOffset);
      return r;
    }

    refresh() {
      // Were we in an empty container before?
      if (this.currentNode === this.container) {
        // re-initialize
        this.currentNode = this.getNextNode() || this.currentNode;
        this._makeClone();
      }

      // Was the currentNode removed?
      // If not, we don't need to do anything, since our state is completely
      // dependent on the current node
      // TODO: If the current node is a text node and has been modified, then we
      // either need to choose a new current node, and/or change the localOffset
      if (isDescendant(this.currentNode, this.container)) {
        // Were we at the end of content before?
        if (this.currentNode.nodeType === 3 &&
            this.localOffset === this.currentNode.nodeValue.length) {
          // Move to new content if any was added
          this.nextPosition();
        }
      } else {
        // The currentNode was removed. We need to find the clone of currentNode
        // find a suitable replacement clone, then find the original for that
        // clone.
        // TODO: if the currentNode was replaced, select the replacement
        let cloneIterator = document.createNodeIterator(this._containerClone);
        let c = this._containerClone;

        while (c !== null) {
          if (c === this._currentNodeClone) {
            // Get next node, or previous node
            // TODO: need to make sure the new node is in the container too

            // Prefer the next node
            let newCurrentNodeClone = cloneIterator.nextNode();
            if (newCurrentNodeClone !== null) {
              this.localOffset = 0;
            } else {
              // If there's no next node, try the previous node
              // Since we advanced already, we need to call previousNode() twice
              cloneIterator.previousNode();
              newCurrentNodeClone = cloneIterator.previousNode();
              if (newCurrentNodeClone !== null &&
                  newCurrentNodeClone.nodeType === 3) {
                // When moving backwards, set localOffset tot he end of the node
                // Since there's no next node, we use length, not length - 1
                // so that isAtEnd == true
                this.localOffset = this.currentNode.nodeValue.length;
              }
            }
            // If there's no next or previous node, selecte the container
            if (newCurrentNodeClone === null) {
              newCurrentNodeClone = this._containerClone;
              this.localOffset = 0;
            };
            this.currentNode = this._cloneToNodes.get(newCurrentNodeClone);
            this._makeClone();
            break;
          }
          c = cloneIterator.nextNode();
        }
        console.assert(c !== null, 'Could not find the current node clone.');
      }
    }
  }

  function isDescendant(element, target) {
    while (element.parentNode) {
      if (element.parentNode == target) {
        return true;
      }
      element = element.parentNode;
    }
  }

});
