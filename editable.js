function getRange(node, start, end) {
  var startPosition = getPosition(node, start);
  var endPosition = getPosition(node, end);

  var range = new Range();
  range.setStart(startPosition.node, startPosition.offset);
  range.setEnd(endPosition.node, endPosition.offset);
  return range;
}

/**
 * For a given [node] and [offset] into its text content, returns a descendent
 * node and relative offset, suitable for use as a container and offset for a
 * Range object.
 *
 * Example:
 * <div>abc<b>def</b>ghi</div>
 * getPosition($('div'), 2); // returns {node: #text "abc", offset: 2}
 * getPosition($('div'), 7); // returns {node: #text "ghi", offset: 1}
 */
function getPosition(node, offset) {
  var iterator = document.createNodeIterator(node, 
      NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, null);
  var currentNode = node;
  var currentOffset = 0;
  
  // keep iterating even if we're at the right offset so that we drill
  // down to the deepest node at the offset
  while (currentNode !== null && currentOffset <= offset) {
    if (currentNode.nodeType == 1) { // element
      currentNode = iterator.nextNode();
    } else if (currentNode.nodeType == 3) { // text
      var newOffset = currentOffset + currentNode.nodeValue.length;
      if (newOffset > offset) {
        // this is the node we're looking for
        var result = {node: currentNode, offset: offset - currentOffset};
        // console.log("node found ", result);
        return result;
      } else {
        currentOffset = newOffset;
        currentNode = iterator.nextNode();
      }
    } else {
      throw "unexpected node type " + nodeType;
    }
    // console.log("loop end ", currentNode, currentOffset);
  }
  // We ran out of nodes, but are at the right offset, return the last node
  if (currentOffset == offset) {
    currentNode = iterator.previousNode();
    var localOffset = currentNode.nodeType == 1
        ? 0
        : currentNode.nodeValue.length;
    return {node: currentNode, offset: localOffset};
  }
  throw new RangeError("offset " + offset + " is not valid");
}
