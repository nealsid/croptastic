/*jslint newcap: true, vars: true, indent: 2, node:true */
/*global alert:false, Raphael:false, window:false, document:false, $:false */
"use strict";

// An enum that represents some pre-selected positions in the
// viewport.  These aren't in clockwise order so that we can maintain
// consistency with how Rafael orders corners.
CroptasticResizeHandle.ViewportPositionEnum = {
  UL : 0,
  UR : 1,
  LR : 2,
  LL: 3,
  CENTER_TOP : 4,
  CENTER_RIGHT : 5,
  CENTER_LOWER : 6,
  CENTER_LEFT : 7
};
var positionEnum = CroptasticResizeHandle.ViewportPositionEnum;

// Helper class to encapsulate resize handle behavior.  left_right &
// up_down are true if the resize handle has those degrees of freedom.
// position is a value from ViewportPositionEnum and indicates where
// the resize handle is.
function CroptasticResizeHandle(croptastic, viewport, left_right_freedom,
                                up_down_freedom, position,
                                handle_side_length) {
  this.croptastic = croptastic;
  this.viewport = viewport;
  this.left_right_freedom = left_right_freedom;
  this.handle_side_length = handle_side_length;
  this.up_down_freedom = up_down_freedom;
  if (position < 0 || position > 7) {
    return null;
  }
  this.position = position;
  return this;
}

CroptasticResizeHandle.prototype.fixedCornerForSelf = function() {
  switch(this.position) {
  case positionEnum.UL:
    return positionEnum.LR;
  case positionEnum.UR:
    return positionEnum.LL;
  case positionEnum.LR:
    return positionEnum.UL;
  case positionEnum.LL:
    return positionEnum.UR;
  default:
    return null;
  }
};

// x, y are the coordinates around which the resize handle (which is a
// square) is centered on.  fixedpoint_corner_nmber is the corner
// number that remains stationary (or, the origin as Raphael refers to
// it) while a resize handle is being dragged - usually it's the
// opposite corner, but in the future it could be two of them (if we
// support resizing by dragging an edge of the viewport, rather than a
// corner).  The SVG polygons are drawn in clockwise order, to the
// numbering for corners is 0-3 for UL, UR, LR, LL (according to
// Raphael).
CroptasticResizeHandle.prototype.drawResizeHandle = function () {
  var center = this.croptastic.viewportCornerCoordinates(this.position);
  var handle_points = this.squareAroundPoint(center.x,
                                             center.y,
                                             this.handle_side_length);
  var handle_svg = this.pointsToSVGPolygonString(handle_points);
  var handle = this.paper.path(handle_svg).attr("fill",
                                                "#949393").attr("opacity", ".7");
  var croptastic = this;
  /*jslint unparam: true*/
  handle.drag(function (dx, dy, mouseX, mouseY, e) {
    // Convert mouse coordinates from browser (which are in the
    // browser window coordinates) to paper/picture coordinates, which
    // is what Raphael expects.
    var mouseX_local = mouseX - croptastic.xoffset;
    var mouseY_local = mouseY - croptastic.yoffset;

    var viewport_size_dx = 0;
    var viewport_size_dy = 0;
    // There is a UI issue here - by calculating based on the center
    // of the resize handle, there is a noticable visual artifact when
    // the user grabs the handle anywhere but the center of the handle
    // - the handle will "jump" as if the user had grabbed the center
    // of the LR.  Much time was spent trying to correct for this but
    // I had to move onto other things - it definitely should be
    // fixed, though.
    var handle_center_x = handle.matrix.x(handle.attrs.path[0][1],
                                          handle.attrs.path[0][2]) - (croptastic.handle_side_length / 2);
    var handle_center_y = handle.matrix.y(handle.attrs.path[0][1],
                                          handle.attrs.path[0][2]) - (croptastic.handle_side_length / 2);
    viewport_size_dx = mouseX_local - handle_center_x;
    viewport_size_dy = mouseY_local - handle_center_y;
    var fixedpoint = croptastic.viewportCornerCoordinates(croptastic.viewportCornerCoordinates(self.position));
    var fixedpoint_x = fixedpoint.x;
    var fixedpoint_y = fixedpoint.y;
    var newSideLengthX = Math.abs(handle_center_x + viewport_size_dx - fixedpoint_x);
    var newSideLengthY = Math.abs(handle_center_y + viewport_size_dy - fixedpoint_y);

    // Prevent resize if the user has dragged the viewport to be too
    // small in both dimensions.
    if (newSideLengthX < croptastic.viewportSizeThreshold &&
        newSideLengthY < croptastic.viewportSizeThreshold) {
      return;
    }

    // If the user has only hit the minimum in one dimension, we can
    // still resize in the other dimension.
    if (newSideLengthX < croptastic.viewportSizeThreshold) {
      newSideLengthX = croptastic.viewportSizeThreshold;
    } else if (newSideLengthY < croptastic.viewportSizeThreshold) {
      newSideLengthY = croptastic.viewportSizeThreshold;
    }

    croptastic.scaleViewport(newSideLengthX, newSideLengthY,
                             fixedpoint_x, fixedpoint_y);
    croptastic.positionULResizeHandle();
    croptastic.positionURResizeHandle();
    croptastic.positionLRResizeHandle();
    croptastic.positionLLResizeHandle();

    // croptastic.positionResizeHandle(croptastic.ul_handle, 0, 2);
    // croptastic.positionResizeHandle(croptastic.lr_handle, 2, 0);
    croptastic.drawShadeElement();
    croptastic.updatePreview();
  }, function (x, y, e) {
    // We want the handle the user is dragging to move to the front,
    // because if the user drags over another resize handle, we want
    // our cursor to still be shown.
    handle.toFront();

    croptastic.setCursorsForResize(handle.node.style.cursor);
  }, function (e) {
    croptastic.setCursorsForResizeEnd();
  });
  /*jslint unparam: true*/
  handle.toFront();
  return handle;
};

CroptasticResizeHandle.prototype.positionHandle = function() {
  // General algorithm here is to look at the outer corner of the
  // viewport, and subtract the handle side length.  The difference
  // between this new quantity and the original position of the
  // opposite corner of handle is taken as the transform parameter.
  var corner_point = this.croptastic.viewportCornerCoordinates(this.position);
  var corner_x = corner_point.x;
  var corner_y = corner_point.y;
  console.log("drag corner x: " + corner_x);
  console.log("drag corner y: " + corner_y);
  var fixed_corner_num = this.fixedCornerForSelf(this.position);
  var handle_fixed_point_x = this.handle.matrix.x(this.handle.attrs.path[fixed_corner_num][1],
                                                  this.handle.attrs.path[fixed_corner_num][2]);
  var handle_fixed_point_y = this.handle.matrix.y(this.handle.attrs.path[fixed_corner_num][1],
                                                  this.handle.attrs.path[fixed_corner_num][2]);
  var point_distance_x = Math.abs(corner_x - handle_fixed_point_x);
  var point_distance_y = Math.abs(corner_y - handle_fixed_point_y);
  // we need to figure out if the user is dragging the handle "inward"
  // or "outward", where inward/outward means towards or away from the
  // center of the viewport.
  var inward = false;
  var dx = null;
  var dy = null;
  if (corner_x < handle_fixed_point_x) {
    // we're on the left side of the viewport
    dx = this.handle_side_length - point_distance_x;
  } else {
    // we're on the right side of the viewport
    dx = point_distance_x - this.handle_side_length;
  }

  if (corner_y < handle_fixed_point_y) {
    // top of viewport
    dy = this.handle_side_length - point_distance_y;
  } else {
    // bottom of viewport
    dy = point_distance_y - this.handle_side_length;
  }
  var xformString = "T" + dx + "," + dy;
  console.log(xformString);
  this.handle.transform("..." + xformString);
};

function Croptastic(parentNode, previewNode) {
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
  this.ul_handle = null;
  this.ur_handle = null;
  this.lr_handle = null;
  this.ll_handle = null;
  this.right_handle = null;
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
  this.sideLengthX = null;
  this.sideLengthY = null;
  this.viewportSizeThreshold = 20;
}

Croptastic.prototype.setup = function (pic_url) {
  this.parentNode.innerHTML = "";
  this.paper = Raphael(this.parentNode);
  var boundingRect = this.parentNode.getBoundingClientRect();
  this.xoffset = boundingRect.left + window.scrollX;
  this.yoffset = boundingRect.top + window.scrollY;
  this.width = boundingRect.width;
  this.height = boundingRect.height;
  console.log("width: " + this.width);
  console.log("height: " + this.height);
  this.svgImage = this.paper.image(pic_url, 0, 0, this.width, this.height);

  this.viewportCenterX  = this.width / 2;
  this.viewportCenterY = this.height / 2;
  this.sideLengthX = 100;
  this.sideLengthY = 100;
  this.setupViewport();
  if (this.previewNode !== null) {
    this.imageForRaphaelSVGImage = document.createElement("IMG");
    this.imageForRaphaelSVGImage.src = this.svgImage.attr("src");
    this.drawingContext = this.previewNode.getContext("2d");
    this.previewWidth = $("#profile-picture-crop-preview").width();
    this.previewHeight = $("#profile-picture-crop-preview").height();
    this.updatePreview();
  }
};

Croptastic.prototype.updatePreview = function () {
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
    console.log("width multiplier calc");
    console.log("this.imageForRaphaelSVGImage.width: " + this.imageForRaphaelSVGImage.width);
    console.log("this.svgImage.attr(\"width\"): " + this.svgImage.attr("width"));
  }

  if (this.heightMultiplier === null) {
    this.heightMultiplier =
      this.imageForRaphaelSVGImage.height / this.svgImage.attr("height");
    if (this.heightMultiplier === 0) {
      this.heightMultiplier = null;
      return;
    }
    console.log("height multiplier calc");
    console.log("this.imageForRaphaelSVGImage.height: " + this.imageForRaphaelSVGImage.height);
    console.log("this.svgImage.attr(\"height\"): " + this.svgImage.attr("height"));
  }

  this.drawingContext.clearRect(0, 0, this.previewWidth, this.previewHeight);
  var image_coordinate_ul_x = (this.viewportCenterX - (this.sideLengthX / 2)) * this.widthMultiplier;
  var image_coordinate_ul_y = (this.viewportCenterY - (this.sideLengthY / 2)) * this.heightMultiplier;

  // console.log("previewWidth : " + previewWidth );
  // console.log("previewHeight: " + previewHeight);

  // console.log("image_coordinate_ul_x: " + image_coordinate_ul_x);
  // console.log("image_coordinate_ul_y: " + image_coordinate_ul_y);
  // console.log("this.sideLengthX * this.widthMultiplier: " + (this.sideLengthX * this.widthMultiplier));
  // console.log("this.sideLengthY * this.heightMultiplier: " + (this.sideLengthY * this.heightMultiplier));
  this.drawingContext.drawImage(this.imageForRaphaelSVGImage,
                                image_coordinate_ul_x, // start x
                                image_coordinate_ul_y, // start y
                                this.sideLengthX * this.widthMultiplier, // width of source rect
                                this.sideLengthY * this.heightMultiplier, // height of source rect
                                0, 0, this.previewWidth, this.previewHeight); // destination rectangle
};

Croptastic.prototype.pointsToSVGPolygonString = function (points) {
  var svgstring = "M" + points[0].x + "," + points[0].y + " ";
  var i = 0;
  for (i = 1; i < points.length; i += 1) {
    svgstring += "L" + points[i].x + "," + points[i].y + " ";
  }
  svgstring += "Z";
  return svgstring;
};

// Returns an array of points that represent a rectangle with sides
// length sideLength{X,Y} around (x,y).  The points are returned in
// clockwise order starting from the upper left.
Croptastic.prototype.rectangleAroundPoint = function (x, y, sideLengthX, sideLengthY) {
  var halfXSideLength = sideLengthX / 2;
  var halfYSideLength = sideLengthY / 2;
  return [
    {'x' : x - halfXSideLength,   // upper left
     'y' : y - halfYSideLength},

    {'x' : x + halfXSideLength,   // upper right
     'y' : y - halfYSideLength},

    {'x' : x + halfXSideLength,   // lower right
     'y' : y + halfYSideLength},

    {'x' : x - halfXSideLength,   // lower left
     'y' : y + halfYSideLength}
  ];
};

// Returns an array of points that represent a square with sides
// length sideLength around (x,y).  The points are returned in
// clockwise order starting from the upper left.
Croptastic.prototype.squareAroundPoint = function (x, y, sideLength) {
  return this.rectangleAroundPoint(x, y, sideLength, sideLength);
};

Croptastic.prototype.setCursorsForResize = function (cursor) {
  // We have to change the body cursor here because if we don't, the
  // browser will change the cursor to the non-drag one even if the
  // drag is ongoing while the mouse moves over another element.
  this.oldBodyCursor = document.getElementsByTagName("body")[0].style.cursor;
  document.getElementsByTagName("body")[0].style.cursor = cursor;
  this.oldViewportCursor = this.viewportElement.node.style.cursor;
  this.viewportElement.node.style.cursor = cursor;
};

Croptastic.prototype.setCursorsForResizeEnd = function () {
  document.getElementsByTagName("body")[0].style.cursor = this.oldBodyCursor;
  this.viewportElement.node.style.cursor = this.oldViewportCursor;
};

// x, y are the coordinates around which the resize handle (which is a
// square) is centered on.  fixedpoint_corner_nmber is the corner
// number that remains stationary (or, the origin as Raphael refers to
// it) while a resize handle is being dragged - usually it's the
// opposite corner, but in the future it could be two of them (if we
// support resizing by dragging an edge of the viewport, rather than a
// corner).  The SVG polygons are drawn in clockwise order, to the
// numbering for corners is 0-3 for UL, UR, LR, LL (according to
// Raphael).
Croptastic.prototype.drawResizeHandle = function (center_x, center_y,
                                                  fixedpoint_corner_number) {
  var handle_points = this.squareAroundPoint(center_x,
                                             center_y,
                                             this.handle_side_length);
  var handle_svg = this.pointsToSVGPolygonString(handle_points);
  var handle = this.paper.path(handle_svg).attr("fill",
                                                "#949393").attr("opacity", ".7");
  var croptastic = this;
  /*jslint unparam: true*/
  handle.drag(function (dx, dy, mouseX, mouseY, e) {
    // Convert mouse coordinates from browser (which are in the
    // browser window coordinates) to paper/picture coordinates, which
    // is what Raphael expects.
    var mouseX_local = mouseX - croptastic.xoffset;
    var mouseY_local = mouseY - croptastic.yoffset;

    var viewport_size_dx = 0;
    var viewport_size_dy = 0;
    // There is a UI issue here - by calculating based on the center
    // of the resize handle, there is a noticable visual artifact when
    // the user grabs the handle anywhere but the center of the handle
    // - the handle will "jump" as if the user had grabbed the center
    // of the LR.  Much time was spent trying to correct for this but
    // I had to move onto other things - it definitely should be
    // fixed, though.
    var handle_center_x = handle.matrix.x(handle.attrs.path[0][1],
                                          handle.attrs.path[0][2]) - (croptastic.handle_side_length / 2);
    var handle_center_y = handle.matrix.y(handle.attrs.path[0][1],
                                          handle.attrs.path[0][2]) - (croptastic.handle_side_length / 2);
    viewport_size_dx = mouseX_local - handle_center_x;
    viewport_size_dy = mouseY_local - handle_center_y;
    var fixedpoint = croptastic.viewportCornerCoordinates(fixedpoint_corner_number);
    var fixedpoint_x = fixedpoint.x;
    var fixedpoint_y = fixedpoint.y;
    var newSideLengthX = Math.abs(handle_center_x + viewport_size_dx - fixedpoint_x);
    var newSideLengthY = Math.abs(handle_center_y + viewport_size_dy - fixedpoint_y);

    // Prevent resize if the user has dragged the viewport to be too
    // small in both dimensions.
    if (newSideLengthX < croptastic.viewportSizeThreshold &&
        newSideLengthY < croptastic.viewportSizeThreshold) {
      return;
    }

    // If the user has only hit the minimum in one dimension, we can
    // still resize in the other dimension.
    if (newSideLengthX < croptastic.viewportSizeThreshold) {
      newSideLengthX = croptastic.viewportSizeThreshold;
    } else if (newSideLengthY < croptastic.viewportSizeThreshold) {
      newSideLengthY = croptastic.viewportSizeThreshold;
    }

    croptastic.scaleViewport(newSideLengthX, newSideLengthY,
                             fixedpoint_x, fixedpoint_y);
    croptastic.positionULResizeHandle();
    croptastic.positionURResizeHandle();
    croptastic.positionLRResizeHandle();
    croptastic.positionLLResizeHandle();

    // croptastic.positionResizeHandle(croptastic.ul_handle, 0, 2);
    // croptastic.positionResizeHandle(croptastic.lr_handle, 2, 0);
    croptastic.drawShadeElement();
    croptastic.updatePreview();
  }, function (x, y, e) {
    // We want the handle the user is dragging to move to the front,
    // because if the user drags over another resize handle, we want
    // our cursor to still be shown.
    handle.toFront();

    croptastic.setCursorsForResize(handle.node.style.cursor);
  }, function (e) {
    croptastic.setCursorsForResizeEnd();
  });
  /*jslint unparam: true*/
  handle.toFront();
  return handle;
};

Croptastic.prototype.viewportCornerCoordinates = function (cornerNumber) {
  var pathElement = this.viewportElement.attrs.path[cornerNumber];
  return {
    'x': this.viewportElement.matrix.x(pathElement[1],
                                       pathElement[2]),
    'y': this.viewportElement.matrix.y(pathElement[1],
                                       pathElement[2])
  };
};

Croptastic.prototype.drawViewport = function () {
  var centerX = this.viewportCenterX;
  var centerY = this.viewportCenterY;
  var innerPolyPoints = this.rectangleAroundPoint(centerX, centerY,
                                                  this.sideLengthX,
                                                  this.sideLengthY);
  var viewportSVG = this.pointsToSVGPolygonString(innerPolyPoints);
  if (this.viewportElement !== null) {
    this.viewportElement.remove();
    this.viewportElement = null;
  }

  this.viewportElement = this.paper.path(viewportSVG).attr("fill",
                                                           "transparent");
  if (this.ul_handle !== null) {
    this.ul_handle.remove();
    this.ul_handle = null;
  }

  if (this.ur_handle !== null) {
    this.ur_handle.remove();
    this.ur_handle = null;
  }

  if (this.lr_handle !== null) {
    this.lr_handle.remove();
    this.lr_handle = null;
  }

  if (this.ll_handle !== null) {
    this.ll_handle.remove();
    this.ll_handle = null;
  }

  if (this.right_handle !== null) {
    this.right_handle.remove();
    this.right_handle = null;
  }

  // Draw resize handles.
  this.ul_handle = this.drawResizeHandle(innerPolyPoints[0].x + (this.handle_side_length / 2),
                                         innerPolyPoints[0].y + (this.handle_side_length / 2),
                                         2);

  this.ur_handle = this.drawResizeHandle(innerPolyPoints[1].x - (this.handle_side_length / 2),
                                         innerPolyPoints[1].y + (this.handle_side_length / 2),
                                         3);

  this.lr_handle = this.drawResizeHandle(innerPolyPoints[2].x - (this.handle_side_length / 2),
                                         innerPolyPoints[2].y - (this.handle_side_length / 2),
                                         0);

  this.ll_handle = this.drawResizeHandle(innerPolyPoints[3].x + (this.handle_side_length / 2),
                                         innerPolyPoints[3].y - (this.handle_side_length / 2),
                                         1);

  this.right_handle = this.drawResizeHandle(innerPolyPoints[1].x - (this.handle_side_length / 2), innerPolyPoints[1].y + ((innerPolyPoints[2].y - innerPolyPoints[1].y) / 2), 0);

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
  st.push(this.viewportElement, this.ul_handle, this.ur_handle, this.lr_handle, this.ll_handle);
  this.viewportElementAndHandlesSet = st;
  $(this.viewportElement.node).css("cursor", "-webkit-grabbing");
  $(this.viewportElement.node).css("cursor", "-moz-grabbing");
  this.ul_handle.node.style.cursor = "nwse-resize";
  this.ur_handle.node.style.cursor = "nesw-resize";
  this.lr_handle.node.style.cursor = "nwse-resize";
  this.ll_handle.node.style.cursor = "nesw-resize";
};

Croptastic.prototype.scaleViewport = function (newSideLengthX, newSideLengthY, fixed_point_x, fixed_point_y) {

  var multiplierX = newSideLengthX / this.sideLengthX;
  var multiplierY = newSideLengthY / this.sideLengthY;

  this.sideLengthX = newSideLengthX;
  this.sideLengthY = newSideLengthY;

  var scaleString = "S" + multiplierX + "," +
        multiplierY + "," + fixed_point_x + "," + fixed_point_y;
  this.viewportElement.transform("..." + scaleString);
  var new_point = this.viewportCornerCoordinates(0);
  var newx = new_point.x;
  var newy = new_point.y;
  this.viewportCenterX = newx + (newSideLengthX / 2);
  this.viewportCenterY = newy + (newSideLengthY / 2);
};

Croptastic.prototype.moveInnerViewport = function (dx, dy) {
  var xformString = "T" + dx + "," + dy;
  this.viewportElementAndHandlesSet.transform("..." + xformString);
  this.updatePreview();
};

Croptastic.prototype.positionResizeHandle = function(handle,
                                                     corner,
                                                     fixed_corner_num) {
  // General algorithm here is to look at the outer corner of the
  // viewport, and subtract the handle side length.  The difference
  // between this new quantity and the original position of the
  // opposite corner of handle is taken as the transform parameter.
  var corner_point = this.viewportCornerCoordinates(corner);
  var corner_x = corner_point.x;
  var corner_y = corner_point.y;
  console.log("drag corner x: " + corner_x);
  console.log("drag corner y: " + corner_y);
  var handle_fixed_point_x = handle.matrix.x(handle.attrs.path[fixed_corner_num][1],
                                             handle.attrs.path[fixed_corner_num][2]);
  var handle_fixed_point_y = handle.matrix.y(handle.attrs.path[fixed_corner_num][1],
                                             handle.attrs.path[fixed_corner_num][2]);
  var point_distance_x = Math.abs(corner_x - handle_fixed_point_x);
  var point_distance_y = Math.abs(corner_y - handle_fixed_point_y);
  // we need to figure out if the user is dragging the handle "inward"
  // or "outward", where inward/outward means towards or away from the
  // center of the viewport.
  var inward = false;
  var dx = null;
  var dy = null;
  if (corner_x < handle_fixed_point_x) {
    // we're on the left side of the viewport
    dx = this.handle_side_length - point_distance_x;
  } else {
    // we're on the right side of the viewport
    dx = point_distance_x - this.handle_side_length;
  }

  if (corner_y < handle_fixed_point_y) {
    // top of viewport
    dy = this.handle_side_length - point_distance_y;
  } else {
    // bottom of viewport
    dy = point_distance_y - this.handle_side_length;
  }
  var xformString = "T" + dx + "," + dy;
  console.log(xformString);
  handle.transform("..." + xformString);
};

Croptastic.prototype.positionULResizeHandle = function () {
  var viewport_ul = this.viewportCornerCoordinates(0);
  var viewport_ul_x = viewport_ul.x;
  var viewport_ul_y = viewport_ul.y;
  var ul_handle_lr_x = this.ul_handle.matrix.x(this.ul_handle.attrs.path[2][1],
                                               this.ul_handle.attrs.path[2][2]);
  var ul_handle_lr_y = this.ul_handle.matrix.y(this.ul_handle.attrs.path[2][1],
                                               this.ul_handle.attrs.path[2][2]);
  var dx = viewport_ul_x + this.handle_side_length - ul_handle_lr_x;
  var dy = viewport_ul_y + this.handle_side_length - ul_handle_lr_y;
  var xformString = "T" + dx + "," + dy;
  this.ul_handle.transform("..." + xformString);
};

Croptastic.prototype.positionURResizeHandle = function () {
  var viewport_ur = this.viewportCornerCoordinates(1);
  var viewport_ur_x = viewport_ur.x;
  var viewport_ur_y = viewport_ur.y;
  console.log("UR corner x: " + viewport_ur_x);
  console.log("UR corner y: " + viewport_ur_y);
  var ur_handle_ll_x = this.ur_handle.matrix.x(this.ur_handle.attrs.path[3][1],
                                               this.ur_handle.attrs.path[3][2]);
  var ur_handle_ll_y = this.ur_handle.matrix.y(this.ur_handle.attrs.path[3][1],
                                               this.ur_handle.attrs.path[3][2]);
  var dx = viewport_ur_x - this.handle_side_length - ur_handle_ll_x;
  var dy = viewport_ur_y + this.handle_side_length - ur_handle_ll_y;
  var xformString = "T" + dx + "," + dy;
  this.ur_handle.transform("..." + xformString);
};

Croptastic.prototype.positionLRResizeHandle = function () {
  // General algorithm here is to look at the lower right of the
  // viewport, and subtract the handle side length.  The difference
  // between this new quantity and the original position of the lower
  // right handle is taken as the transform parameter (specifically,
  // the upper left corner of the lower right handle).
  var viewport_lr = this.viewportCornerCoordinates(2);
  var viewport_lr_x = viewport_lr.x;
  var viewport_lr_y = viewport_lr.y;

  var lr_handle_ul_x = this.lr_handle.matrix.x(this.lr_handle.attrs.path[0][1],
                                               this.lr_handle.attrs.path[0][2]);
  var lr_handle_ul_y = this.lr_handle.matrix.y(this.lr_handle.attrs.path[0][1],
                                               this.lr_handle.attrs.path[0][2]);
  var dx = viewport_lr_x - this.handle_side_length - lr_handle_ul_x;
  var dy = viewport_lr_y - this.handle_side_length - lr_handle_ul_y;
  var xformString = "T" + dx + "," + dy;
  this.lr_handle.transform("..." + xformString);
};

Croptastic.prototype.positionLLResizeHandle = function () {
  var viewport_ll = this.viewportCornerCoordinates(3);
  var viewport_ll_x = viewport_ll.x;
  var viewport_ll_y = viewport_ll.y;

  var ll_handle_ur_x = this.ll_handle.matrix.x(this.ll_handle.attrs.path[1][1],
                                               this.ll_handle.attrs.path[1][2]);
  var ll_handle_ur_y = this.ll_handle.matrix.y(this.ll_handle.attrs.path[1][1],
                                               this.ll_handle.attrs.path[1][2]);
  var dx = viewport_ll_x + this.handle_side_length - ll_handle_ur_x;
  var dy = viewport_ll_y - this.handle_side_length - ll_handle_ur_y;
  var xformString = "T" + dx + "," + dy;
  this.ll_handle.transform("..." + xformString);
};

Croptastic.prototype.drawShadeElement = function () {
  if (this.shadeElement !== null) {
    this.shadeElement.remove();
    this.shadeElement = null;
  }
  var polyFill = "#949393";
  var fillOpacity = 0.7;
  var centerX = this.viewportCenterX;
  var centerY = this.viewportCenterY;
  var viewport_points = this.rectangleAroundPoint(centerX, centerY, this.sideLengthX, this.sideLengthY);
  var outerPolyPoints = [{'x' : 0, 'y' : 0},
                         {'x' : this.width, 'y' : 0},
                         {'x' : this.width, 'y' : this.height},
                         {'x' : 0, 'y' : this.height}];
  // Note the order of the points - it's required to go counter
  // clockwise with Raphael so that it considers this a subtraction
  // from the outer polygon.
  var innerPolyPoints = viewport_points.reverse();

  var polySVG = this.pointsToSVGPolygonString(outerPolyPoints);
  polySVG += this.pointsToSVGPolygonString(innerPolyPoints);
  this.shadeElement = this.paper.path(polySVG).attr("fill", polyFill).attr("opacity", fillOpacity);
  this.shadeElement.toBack();
  this.svgImage.toBack();
};

Croptastic.prototype.setupViewport = function () {
  this.drawShadeElement();
  this.drawViewport();
};
