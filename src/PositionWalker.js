/**
 * @license
 * Copyright (c) 2015 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at http://polymer.github.io/PATENTS.txt
 */

 define('editable/PositionWalker', function() {
   'use strict';

 /**
  * PositionWalker keeps track of a position within a DOM subtree, as a
  * current node and an offset within that node.
  *
  * PositionWalker is similar to NodeIterator with the addition of the
  * offset tracking and the ability to move forward and backward by character
  * position within a node.
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
      this.currentNode = node;
      this.offset = 0;
      this.localOffset = 0;
      this.isAtEnd = false;
      this.isAtBeginning = true;

      // initialize state to first text position
      var n = this.getNextNode();
      if (n == null) {
        this.isAtEnd = true;
      } else {
        this.currentNode = n;
      }
    }

    getNextNode() {
      var n = this.currentNode;

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
          throw "parent null";
        }
      	n = n.parentNode;
      }

      if (n == this.container) {
      	return null;
      }
      return n.nextSibling;
    }

    nextNode() {
      var n = this.currentNode;
      if (n.nodeType == 3) {
        this.offset += n.nodeValue.length - this.localOffset;
        this.localOffset = 0;
      }
      n = this.getNextNode();
      if (n == null) {
        // TODO: test when we're in the last node, but not at the end of it
        this.isAtEnd = true;
      } else {
        this.isAtBeginning = false;
        this.currentNode = n;
      }
    }

    nextPosition() {
      if (this.isAtEnd) {
        return;
      }

      if (this.currentNode.nodeType == 3 &&
          this.localOffset < this.currentNode.nodeValue.length - 1) {
        this.localOffset++;
        this.offset++;
        this.isAtBeginning = false;
        if (this.localOffset == this.currentNode.nodeValue.length
            && this.getNextNode() == null) {
          this.isAtEnd = true;
        }
        return;
      }

      while (this.currentNode != null) {
        var n = this.getNextNode();
        if (n == null && this.currentNode.nodeType == 3) {
          // normally localOffset is always 0 when we finish a node
          // but for the last text node we want to position at the end
          // of the node instead of the beginning of the next node.
          this.localOffset = this.currentNode.nodeValue.length;
          this.offset++;
          this.isAtEnd = true;
          return;
        } else if (n.nodeType == 3) {
          this.nextNode();
          return;
        }
        this.nextNode();
      }
    }

    getPreviousNode() {
      var n = this.currentNode;

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
      var n = this.currentNode;
      if (n.nodeType == 3) {
        this.offset -= this.localOffset;
        this.localOffset = 0;
      }
      n = this.getPreviousNode();
      if (n == null) {
        // TODO: test when we're in the last node, but not at the end of it
        this.isAtBeginning = true;
      } else {
        this.isAtEnd = false;
        this.currentNode = n;
      }
    }

    previousPosition() {
      if (this.isAtBeginning) {
        return;
      }

      if (this.currentNode.nodeType == 3 && this.localOffset > 0) {
        this.localOffset--;
        this.offset--;
        this.isAtEnd = false;
        if (this.localOffset == 0 && this.getPreviousNode() == null) {
          this.isAtBeginning = true;
        }
        return;
      }

      while (this.currentNode != null) {
        var n = this.getPreviousNode();
        if (n != null && n.nodeType == 3) {
          this.localOffset = n.nodeValue.length - 1;
          this.offset--;
          this.currentNode = n;
          return;
        } else {
          this.currentNode = n;
        }
      }
    }

    clone() {
      var c = new PositionWalker(this.container);
      c.currentNode = this.currentNode;
      c.offset = this.offset;
      c.localOffset = this.localOffset;
      return c;
    }

    getRange() {
      var r = new Range();
      r.setStart(this.currentNode, this.localOffset);
      r.setEnd(this.currentNode, this.localOffset);
      return r;
    }

    getCaretRange() {
      var r = new Range();
      r.setStart(this.currentNode, this.localOffset);
      var endOffset = this.localOffset;
      if (this.currentNode.nodeType == 3 &&
          this.localOffset < this.currentNode.nodeValue.length) {
        endOffset = this.localOffset + 1;
      }
      r.setEnd(this.currentNode, endOffset);
      return r;
    }
  }

});
