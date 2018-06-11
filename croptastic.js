/*jslint newcap: true, vars: true, indent: 2, plusplus: true */
/*global alert, Raphael, window, document, $, console */
"use strict";

// The following three functions are defined so we call them via
// function pointer.
function add(a, b) {
  return a + b;
}

function subtract(a, b) {
  return a - b;
}

function identity(a) {
  return a;
}

const UL = Symbol();
const UR = Symbol();
const LR = Symbol();
const LL = Symbol();
const CENTER_TOP = Symbol();
const CENTER_RIGHT = Symbol();
const CENTER_BOTTOM = Symbol();
const CENTER_LEFT = Symbol();

function getPropertiesForHandle(handle) {
  switch(handle) {
  case UL:
    return {
      'offset_x' : add,
      'offset_y' : add,
      'left_right_freedom': true,
      'up_down_freedom': true,
      'cursor' : "nwse-resize"
    };
  case UR:
    return {
      'offset_x' : subtract,
      'offset_y' : add,
      'left_right_freedom': true,
      'up_down_freedom': true,
      'cursor' : "nesw-resize"
    };
  case LR:
    return {
      'offset_x' : subtract,
      'offset_y' : subtract,
      'left_right_freedom': true,
      'up_down_freedom': true,
      'cursor' : "nwse-resize"
    };
  case LL:
    return {
      'offset_x' : add,
      'offset_y' : subtract,
      'left_right_freedom': true,
      'up_down_freedom': true,
      'cursor' : "nesw-resize"
    };
  case CENTER_TOP :
    return {
      'offset_x' : identity,
      'offset_y' : add,
      'left_right_freedom': false,
      'up_down_freedom': true,
      'cursor' : "ns-resize"
    };
  case CENTER_RIGHT:
    return {
      'offset_x' : subtract,
      'offset_y' : identity,
      'left_right_freedom': true,
      'up_down_freedom': false,
      'cursor' : "ew-resize"
    };
  case CENTER_BOTTOM:
    return {
      'offset_x' : identity,
      'offset_y' : subtract,
      'left_right_freedom': false,
      'up_down_freedom': true,
      'cursor' : "ns-resize"
    };
  case CENTER_LEFT:
    return {
      'offset_x' : add,
      'offset_y' : identity,
      'left_right_freedom': true,
      'up_down_freedom': false,
      'cursor' : "ew-resize"
    };
  }
  throw "Invalid position specified";
}

// Helper class to encapsulate resize handle behavior.  left_right &
// up_down are true if the resize handle has those degrees of freedom.
// position is a value from ViewportPositionEnum and indicates where
// the resize handle is.
class CroptasticResizeHandle {
  constructor(croptastic, viewport,
              position,
              handle_side_length) {
    this.position = position;
    this.croptastic = croptastic;
    this.viewport = viewport;
    this.left_right_freedom = getPropertiesForHandle(this.position).left_right_freedom;
    this.up_down_freedom = getPropertiesForHandle(this.position).up_down_freedom;
    this.handle_side_length = handle_side_length;
    this.handle = null;
  }

  resizeHandleCenterCoordinate() {
    var center = this.croptastic.positionCoordinates(this.position);
    var handle_center = {};
    handle_center.x = getPropertiesForHandle(this.position).offset_x(center.x,
								      this.handle_side_length / 2);
    handle_center.y = getPropertiesForHandle(this.position).offset_y(center.y,
								      this.handle_side_length / 2);
    return handle_center;
  }

  setHandleCursor(cursor) {
    if (cursor !== undefined) {
      this.handle.node.style.cursor = cursor;
    } else {
      this.handle.node.style.cursor = getPropertiesForHandle(this.position).cursor;
    }
  }

  drawResizeHandle() {
    var handle_center = this.resizeHandleCenterCoordinate();
    var handle_points = squareAroundPoint(handle_center.x, handle_center.y,
                                          this.handle_side_length);
    var handle_svg = pointsToSVGPolygonString(handle_points);
    this.handle =
      this.croptastic.paper.path(handle_svg).attr("fill",
                                                  "#949393").attr("opacity", ".7");
    this.setHandleCursor();

    var croptastic = this;
    /*jslint unparam: true*/
    var handle = this.handle;
    handle.drag(function (dx, dy, mouseX, mouseY, e) {
      // Convert mouse coordinates from browser (which are in the
      // browser window coordinates) to paper/picture coordinates, which
      // is what Raphael expects.
      var mouseX_local = mouseX - croptastic.croptastic.xoffset;
      var mouseY_local = mouseY - croptastic.croptastic.yoffset;

      var viewport_size_dx = 0;
      var viewport_size_dy = 0;

      var newSideLengthX = croptastic.croptastic.sideLengthX;
      var newSideLengthY = croptastic.croptastic.sideLengthY;
      // There is a UI issue here - by calculating based on the center
      // of the resize handle, there is a noticable visual artifact when
      // the user grabs the handle anywhere but the center of the handle
      // - the handle will "jump" as if the user had grabbed the center
      // of the LR.  Much time was spent trying to correct for this but
      // I had to move onto other things - it definitely should be
      // fixed, though.
      if (croptastic.left_right_freedom) {
	var handle_center_x = handle.matrix.x(handle.attrs.path[0][1],
                                              handle.attrs.path[0][2]) + (croptastic.handle_side_length / 2);
	viewport_size_dx = mouseX_local - handle_center_x;
	if (croptastic.position === positionEnum.UL ||
            croptastic.position === positionEnum.LL ||
            croptastic.position === positionEnum.CENTER_LEFT) {
          viewport_size_dx *= -1;
	}
	newSideLengthX += viewport_size_dx;
      }

      if (croptastic.up_down_freedom) {
	var handle_center_y = handle.matrix.y(handle.attrs.path[0][1],
                                              handle.attrs.path[0][2]) + (croptastic.handle_side_length / 2);
	viewport_size_dy = mouseY_local - handle_center_y;
	if (croptastic.position === positionEnum.UL ||
            croptastic.position === positionEnum.UR ||
            croptastic.position === positionEnum.CENTER_TOP) {
          viewport_size_dy *= -1;
	}
	newSideLengthY += viewport_size_dy;
      }

      // Prevent resize if the user has dragged the viewport to be too
      // small in both dimensions.
      if (newSideLengthX < croptastic.croptastic.viewportSizeThreshold &&
          newSideLengthY < croptastic.croptastic.viewportSizeThreshold) {
	return;
      }

      // If the user has only hit the minimum in one dimension, we can
      // still resize in the other dimension.
      if (newSideLengthX < croptastic.croptastic.viewportSizeThreshold) {
	newSideLengthX = croptastic.croptastic.viewportSizeThreshold;
      } else if (newSideLengthY < croptastic.croptastic.viewportSizeThreshold) {
	newSideLengthY = croptastic.croptastic.viewportSizeThreshold;
      }

      var scale_origin = croptastic.croptastic.positionCoordinates(croptastic.fixedCornerForSelf(this.position));
      var scale_origin_x = scale_origin.x;
      var scale_origin_y = scale_origin.y;
      croptastic.croptastic.scaleViewport(newSideLengthX, newSideLengthY,
                                          scale_origin_x, scale_origin_y);
      croptastic.croptastic.positionAllResizeHandles();

      croptastic.croptastic.drawShadeElement();
      croptastic.croptastic.updatePreview();
    }, function (x, y, e) {
      // We want the handle the user is dragging to move to the front,
      // because if the user drags over another resize handle, we want
      // our cursor to still be shown.
      handle.toFront();

      croptastic.croptastic.setCursorsForResize(handle.node.style.cursor);
    }, function (e) {
      croptastic.croptastic.setCursorsForResizeEnd();
    });
    /*jslint unparam: true*/
    handle.toFront();
    return handle;
  }

  fixedCornerForSelf() {
    switch (this.position) {
    case UL:
      return LR;
    case UR:
      return LL;
    case LR:
      return UL;
    case LL:
      return UR;
    case CENTER_TOP:
      return LL;
    case CENTER_RIGHT:
      return UL;
    case CENTER_BOTTOM:
      return UL;
    case CENTER_LEFT:
      return UR;
    default:
      return null;
    }
  }

  positionHandle() {
    var center = this.croptastic.positionCoordinates(this.position);
    var new_handle_center = this.resizeHandleCenterCoordinate();

    var current_handle_center_x = this.handle.matrix.x(this.handle.attrs.path[0][1],
						       this.handle.attrs.path[0][2]) + (this.handle_side_length / 2);
    var current_handle_center_y = this.handle.matrix.y(this.handle.attrs.path[0][1],
						       this.handle.attrs.path[0][2]) + (this.handle_side_length / 2);
    var point_distance_x = new_handle_center.x - current_handle_center_x;
    var point_distance_y = new_handle_center.y - current_handle_center_y;
    var xformString = "T" + point_distance_x + "," + point_distance_y;
    this.handle.transform("..." + xformString);
  }

}


class Croptastic {
  constructor(parentNode, previewNode) {
    this.parentNode = parentNode;
    this.paper = null;
    this.viewportCenterX = null;
    this.viewportCenterY = null;
    this.width = null;
    this.height = null;
    // The inner viewport that is transparent
    this.viewportElement = null;
    // This is the Raphael set that contains the viewportElement as well
    // as the resize handles.  We put them in a set so that they move as
    // one element when the viewport is dragged by the user.
    this.viewportElementAndHandlesSet = null;
    this.resizeHandles = [];
    this.handle_side_length = 15;
    // The outer element that is shaded, to indicate to users which
    // parts of the image aren't currently included.
    this.shadeElement = null;
    // The event handlers give window-relative coordinates, so store
    // the origin of the paper (in window-coordinates) to subtract from
    // event handler coordinates.
    this.xoffset = null;
    this.yoffset = null;

    if (previewNode !== null &&
	previewNode.tagName.toLowerCase() !== "canvas") {
      alert("Preview widget needs to be canvas");
    }

    // Preview-related object references
    this.previewNode = previewNode;
    this.previewWidth = null;
    this.previewHeight = null;
    // This stores a corresponding IMG DOM object for the IMAGE one that
    // Raphael creates (the Raphael one is SVG-specific).
    this.imageForRaphaelSVGImage = null;
    this.svgImage = null;
    this.drawingContext = null;
    this.widthMultiplier = null;
    this.heightMultiplier = null;
    this.sideLengthX = 100;
    this.sideLengthY = 100;
    this.viewportSizeThreshold = 20;
  }

  setup(pic_url) {
    this.parentNode.innerHTML = "";
    this.paper = Raphael(this.parentNode);
    var boundingRect = this.parentNode.getBoundingClientRect();
    this.xoffset = boundingRect.left + window.scrollX;
    this.yoffset = boundingRect.top + window.scrollY;
    this.width = boundingRect.width;
    this.height = boundingRect.height;
    this.svgImage = this.paper.image(pic_url, 0, 0, this.width, this.height);

    this.viewportCenterX  = this.width / 2;
    this.viewportCenterY = this.height / 2;
    this.setupViewport();
    if (this.previewNode !== null) {
      this.imageForRaphaelSVGImage = document.createElement("IMG");
      this.imageForRaphaelSVGImage.src = this.svgImage.attr("src");
      this.drawingContext = this.previewNode.getContext("2d");
      this.previewWidth = $("#profile-picture-crop-preview").width();
      this.previewHeight = $("#profile-picture-crop-preview").height();
      this.updatePreview();
    }
  }

  updatePreview() {
    if (this.previewNode === null) {
      return;
    }
    // We set these once by comparing with NULL here because we don't
    // know if the image has actually been loaded yet in the setup
    // function.
    if (this.widthMultiplier === null) {
      // The image isn't actually attached to the DOM, so width/height
      // and naturalWidth,naturalHeight (resp) are the same.
      this.widthMultiplier =
	this.imageForRaphaelSVGImage.width / this.svgImage.attr("width");
      if (this.widthMultiplier === 0) {
	this.widthMultiplier = null;
	return;
      }
    }

    if (this.heightMultiplier === null) {
      this.heightMultiplier =
	this.imageForRaphaelSVGImage.height / this.svgImage.attr("height");
      if (this.heightMultiplier === 0) {
	this.heightMultiplier = null;
	return;
      }
    }

    this.drawingContext.clearRect(0, 0, this.previewWidth, this.previewHeight);
    var image_coordinate_ul_x = (this.viewportCenterX - (this.sideLengthX / 2)) * this.widthMultiplier;
    var image_coordinate_ul_y = (this.viewportCenterY - (this.sideLengthY / 2)) * this.heightMultiplier;

    this.drawingContext.drawImage(this.imageForRaphaelSVGImage,
                                  image_coordinate_ul_x, // start x
                                  image_coordinate_ul_y, // start y
                                  this.sideLengthX * this.widthMultiplier, // width of source rect
                                  this.sideLengthY * this.heightMultiplier, // height of source rect
                                  0, 0, this.previewWidth, this.previewHeight); // destination rectangle
  }

  setCursorsForResize(cursor) {
    // We have to change the body cursor here because if we don't, the
    // browser will change the cursor to the non-drag one even if the
    // drag is ongoing while the mouse moves over another element.
    this.oldBodyCursor = document.getElementsByTagName("body")[0].style.cursor;
    document.getElementsByTagName("body")[0].style.cursor = cursor;
    this.oldViewportCursor = this.viewportElement.node.style.cursor;
    this.viewportElement.node.style.cursor = cursor;
    var i = 0;
    for (i = 0; i < this.resizeHandles.length ; i++) {
      this.resizeHandles[i].setHandleCursor(cursor);
    }
  }

  setCursorsForResizeEnd() {
    document.getElementsByTagName("body")[0].style.cursor = this.oldBodyCursor;
    this.viewportElement.node.style.cursor = this.oldViewportCursor;
    for (let i = 0; i < this.resizeHandles.length ; i++) {
      this.resizeHandles[i].setHandleCursor();
    }
  }

  positionCoordinates(position) {
    let ul, ur, lr, ll;
    switch (position) {
    case UL:
    case UR:
    case LR:
    case LL:
      return this.viewportCornerCoordinates(position);
    case CENTER_TOP:
      ul = this.positionCoordinates(UL);
      ur = this.positionCoordinates(UR);
      return {
	'x': ur.x - ((ur.x - ul.x) / 2),
	'y': ul.y
      };
    case CENTER_RIGHT:
      ur = this.positionCoordinates(UR);
      lr = this.positionCoordinates(LR);
      return {
	'x': ur.x,
	'y': lr.y - ((lr.y - ur.y) / 2)
      };
    case CENTER_BOTTOM:
      lr = this.positionCoordinates(LR);
      ll = this.positionCoordinates(LL);
      return {
	'x': lr.x - ((lr.x - ll.x) / 2),
	'y': ll.y
      };
    case CENTER_LEFT:
      ul = this.positionCoordinates(UL);
      ll = this.positionCoordinates(LL);
      return {
	'x': ul.x,
	'y': ll.y - ((ll.y - ul.y) / 2)
      };
    default:
      return null;
    }
  }

  viewportCornerCoordinates(cornerNumber) {
    var pathElement = this.viewportElement.attrs.path[cornerNumber];
    return {
      'x': this.viewportElement.matrix.x(pathElement[1],
					 pathElement[2]),
      'y': this.viewportElement.matrix.y(pathElement[1],
					 pathElement[2])
    };
  }

  positionAllResizeHandles() {
    var i = 0;
    for (i = 0; i < this.resizeHandles.length; ++i) {
      this.resizeHandles[i].positionHandle();
    }
  }

  drawResizeHandles() {
    var i = 0;
    for (i = 0; i < this.resizeHandles.length; ++i) {
      this.resizeHandles[i].drawResizeHandle();
    }
  }

  drawViewport() {
    var centerX = this.viewportCenterX;
    var centerY = this.viewportCenterY;
    var innerPolyPoints = rectangleAroundPoint(centerX, centerY,
                                               this.sideLengthX,
                                               this.sideLengthY);
    var viewportSVG = pointsToSVGPolygonString(innerPolyPoints);
    if (this.viewportElement !== null) {
      this.viewportElement.remove();
      this.viewportElement = null;
    }

    this.viewportElement = this.paper.path(viewportSVG).attr("fill",
                                                             "transparent");
    var ul_coordinate = innerPolyPoints[0];
    // var gridline_points = [];
    // var grid_start_x = ul_coordinate.x + (this.sideLengthX / 3);
    // var grid_start_y = ul_coordinate.y;
    // var grid_end_x = ul_coordinate.x + (this.sideLengthX / 3);
    // var grid_end_y = innerPolyPoints[3].y;
    // gridline_points.push({'x':grid_start_x,'y':grid_start_y}, {'x':grid_end_x, 'y':grid_end_y});
    // var gridlineString = pointsToSVGPolygonString(gridline_points);
    // this.gridlineElement = this.paper.path(gridlineString);
    // Hack to make it work in Firefox, since it doesn't appear to send
    // mouse events to elements with no fill.  Works fine in
    // Chrome/Safari, though.
    $(this.viewportElement.node).css("pointer-events", "visibleFill");
    // Draw resize handles.
    var handle = null;
    handle = new CroptasticResizeHandle(this,
					this.viewportElement,
					UL,
					this.handle_side_length);

    this.resizeHandles.push(handle);
    handle = new CroptasticResizeHandle(this,
					this.viewportElement,
					UR,
					this.handle_side_length);

    this.resizeHandles.push(handle);

    handle = new CroptasticResizeHandle(this,
					this.viewportElement,
					LR,
					this.handle_side_length);

    this.resizeHandles.push(handle);

    handle = new CroptasticResizeHandle(this,
					this.viewportElement,
					LL,
					this.handle_side_length);
    this.resizeHandles.push(handle);

    handle = new CroptasticResizeHandle(this,
					this.viewportElement,
					CENTER_TOP,
					this.handle_side_length);
    this.resizeHandles.push(handle);

    handle = new CroptasticResizeHandle(this,
					this.viewportElement,
					CENTER_RIGHT,
					this.handle_side_length);
    this.resizeHandles.push(handle);

    handle = new CroptasticResizeHandle(this,
					this.viewportElement,
					CENTER_BOTTOM,
					this.handle_side_length);
    this.resizeHandles.push(handle);

    handle = new CroptasticResizeHandle(this,
					this.viewportElement,
					CENTER_LEFT,
					this.handle_side_length);
    this.resizeHandles.push(handle);

    this.drawResizeHandles();

    var croptastic = this;
    // dx/dy from Raphael are the changes in x/y from the drag start,
    // not the most recent change of the mouse.  Since we want to
    // track the mouse cursor as the user moves it, we need to figure
    // out the change from the last drag event we got, not the start
    // of the drag.  We store the last x/y we've received in
    // Croptastic.last{x,y}.
    /*jslint unparam: true*/
    this.viewportElement.drag(function (dx, dy, x, y, e) {
      var realDX = (x - croptastic.lastx);
      var realDY = (y - croptastic.lasty);
      croptastic.viewportCenterX += realDX;
      croptastic.viewportCenterY += realDY;
      croptastic.lastx = x;
      croptastic.lasty = y;
      croptastic.moveInnerViewport(realDX, realDY);
      croptastic.drawShadeElement();
    }, function (x, y, e) {
      croptastic.lastx = x;
      croptastic.lasty = y;
    });
    /*jslint unparam: false*/

    var st;
    st = this.paper.set();
    st.push(this.viewportElement);
    var i = 0;
    for (i = 0; i < this.resizeHandles.length; ++i) {
      st.push(this.resizeHandles[i].handle);
    }
    // st.push(this.gridlineElement);
    this.viewportElementAndHandlesSet = st;
    $(this.viewportElement.node).css("cursor", "-webkit-grabbing");
    $(this.viewportElement.node).css("cursor", "-moz-grabbing");
  }

  scaleViewport(newSideLengthX, newSideLengthY, fixed_point_x, fixed_point_y) {
    var multiplierX;
    var multiplierY;
    if (newSideLengthX) {
      multiplierX = newSideLengthX / this.sideLengthX;
      this.sideLengthX = newSideLengthX;
    } else {
      multiplierX = 1;
    }

    if (newSideLengthY) {
      multiplierY = newSideLengthY / this.sideLengthY;
      this.sideLengthY = newSideLengthY;
    } else {
      multiplierY = 1;
    }

    var scaleString = "S" + multiplierX + "," +
        multiplierY + "," + fixed_point_x + "," + fixed_point_y;
    this.viewportElement.transform("..." + scaleString);
    // this.gridlineElement.transform("..." + scaleString);
    var new_point = this.positionCoordinates(0);
    var newx = new_point.x;
    var newy = new_point.y;

    if (newSideLengthX) {
      this.viewportCenterX = newx + (newSideLengthX / 2);
    }
    if (newSideLengthY) {
      this.viewportCenterY = newy + (newSideLengthY / 2);
    }
  }

  moveInnerViewport(dx, dy) {
    var xformString = "T" + dx + "," + dy;
    this.viewportElementAndHandlesSet.transform("..." + xformString);
    this.updatePreview();
  }

  drawShadeElement() {
    if (this.shadeElement !== null) {
      this.shadeElement.remove();
      this.shadeElement = null;
    }
    var polyFill = "#949393";
    var fillOpacity = 0.7;
    var centerX = this.viewportCenterX;
    var centerY = this.viewportCenterY;
    var viewport_points = rectangleAroundPoint(centerX, centerY, this.sideLengthX, this.sideLengthY);
    var outerPolyPoints = [{'x' : 0, 'y' : 0},
                           {'x' : this.width, 'y' : 0},
                           {'x' : this.width, 'y' : this.height},
                           {'x' : 0, 'y' : this.height}];
    // Note the order of the points - it's required to go counter
    // clockwise with Raphael so that it considers this a subtraction
    // from the outer polygon.
    var innerPolyPoints = viewport_points.reverse();

    var polySVG = pointsToSVGPolygonString(outerPolyPoints);
    polySVG += pointsToSVGPolygonString(innerPolyPoints);
    this.shadeElement = this.paper.path(polySVG).attr("fill", polyFill).attr("opacity", fillOpacity);
    this.shadeElement.toBack();
    this.svgImage.toBack();
  }

  setupViewport() {
    this.drawShadeElement();
    this.drawViewport();
  }
}

function pointsToSVGPolygonString(points) {
  var svgstring = "M" + points[0].x + "," + points[0].y + " ";
  var i = 0;
  for (i = 1; i < points.length; i += 1) {
    svgstring += "L" + points[i].x + "," + points[i].y + " ";
  }
  svgstring += "Z";
  return svgstring;
}

// Returns an array of points that represent a rectangle with sides
// length sideLength{X,Y} around (x,y).  The points are returned in
// clockwise order starting from the upper left.
function rectangleAroundPoint(x, y, sideLengthX, sideLengthY) {
  var halfXSideLength = sideLengthX / 2;
  var halfYSideLength = sideLengthY / 2;
  return [
    {
      'x' : x - halfXSideLength,   // upper left
      'y' : y - halfYSideLength
    },
    {
      'x' : x + halfXSideLength,   // upper right
      'y' : y - halfYSideLength
    },
    {
      'x' : x + halfXSideLength,   // lower right
      'y' : y + halfYSideLength
    },
    {
      'x' : x - halfXSideLength,   // lower left
      'y' : y + halfYSideLength
    }
  ];
}

// Returns an array of points that represent a square with sides
// length sideLength around (x,y).  The points are returned in
// clockwise order starting from the upper left.
function squareAroundPoint(x, y, sideLength) {
  return rectangleAroundPoint(x, y, sideLength, sideLength);
}

