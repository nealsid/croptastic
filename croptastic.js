/*jslint newcap: true, vars: true, indent: 2, node:true */
/*global alert:false, Raphael:false, window:false, document:false */
"use strict";

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
  this.lr_handle = null;
  this.ur_handle = null;
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
    if (this.widthMultiplier == 0) {
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
    if (this.heightMultiplier == 0) {
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
  return [{'x' : x - halfXSideLength,   // upper left
           'y' : y - halfYSideLength},

          {'x' : x + halfXSideLength,   // upper right
           'y' : y - halfYSideLength},

          {'x' : x + halfXSideLength,   // lower right
           'y' : y + halfYSideLength},

          {'x' : x - halfXSideLength,   // lower left
           'y' : y + halfYSideLength}];
};

// Returns an array of points that represent a square with sides
// length sideLength around (x,y).  The points are returned in
// clockwise order starting from the upper left.
Croptastic.prototype.squareAroundPoint = function (x, y, sideLength) {
  var halfSideLength = sideLength / 2;
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
// square) is centered on.  fixedpoint_{x,y} is the point that remains
// stationary while a resize handle is being dragged - usually it's
// the opposite corner, but in the future it could be two of them (if
// we support resizing by dragging an edge of the viewport, rather
// than a corner)
Croptastic.prototype.drawResizeHandle = function (center_x, center_y,
                                                  fixedpoint_x,
                                                  fixedpoint_y) {
  var handle_points = this.squareAroundPoint(center_x,
                                             center_y,
                                             this.handle_side_length);
  var handle_svg = this.pointsToSVGPolygonString(handle_points);
  var handle = this.paper.path(handle_svg).attr("fill",
                                                "#949393").attr("opacity", ".7");
  var croptastic = this;
  /*jslint unparam: true*/
  handle.drag(function (dx, dy, mouseX, mouseY, e) {
    // NB (nealsid): this comment may no longer be valid, but the
    // handle drag code is in flight while we make it work with all
    // 4 corners.
    // There is a UI issue here - by calculating based on the UL of
    // the LR resize handle, there is a noticable visual artifact when
    // the user grabs the handle anywhere but the UL of the LR handle
    // - the handle will "jump" as if the user had grabbed the UL of
    // the LR.  Much time was spent trying to correct for this but I
    // had to move onto other things - it definitely should be fixed,
    // though.

    // Convert mouse coordinates from browser (which are in the
    // browser window coordinates) to paper/picture coordinates,
    // which is what Raphael expects.
    var mouseX_local = mouseX - croptastic.xoffset;
    var mouseY_local = mouseY - croptastic.yoffset;

    console.log("mouseX_local: " + mouseX_local);
    console.log("mouseY_local: " + mouseY_local);

    var viewport_size_dx = 0;
    var viewport_size_dy = 0;
    var handle_center_x = handle.matrix.x(handle.attrs.path[0][1],
                                          handle.attrs.path[0][2]) - croptastic.handle_side_length;
    var handle_center_y = handle.matrix.y(handle.attrs.path[0][1],
                                          handle.attrs.path[0][2]) - croptastic.handle_side_length;
    viewport_size_dx = mouseX_local - handle_center_x;
    viewport_size_dy = mouseY_local - handle_center_y;
    var newSideLengthX = Math.abs(center_x + viewport_size_dx - fixedpoint_x);
    var newSideLengthY = Math.abs(center_y + viewport_size_dy - fixedpoint_y);

    if (newSideLengthX < croptastic.viewportSizeThreshold &&
        newSideLengthY < croptastic.viewportSizeThreshold) {
      return;
    }

    if (newSideLengthX < croptastic.viewportSizeThreshold) {
      newSideLengthX = croptastic.viewportSizeThreshold;
    } else if (newSideLengthY < croptastic.viewportSizeThreshold) {
      newSideLengthY = croptastic.viewportSizeThreshold;
    }

    croptastic.scaleViewport(newSideLengthX, newSideLengthY,
                             fixedpoint_x, fixedpoint_y);
    croptastic.positionLRResizeHandle();
    croptastic.positionURResizeHandle();
    croptastic.drawShadeElement();
    croptastic.updatePreview();
  }, function (x, y, e) {
    croptastic.setCursorsForResize(handle.node.style.cursor);
  }, function (e) {
    croptastic.setCursorsForResizeEnd();
  });
  /*jslint unparam: true*/
  handle.toFront();
  return handle;
};

Croptastic.prototype.drawViewport = function () {
  var centerX = this.viewportCenterX;
  var centerY = this.viewportCenterY;
  var innerPolyPoints = this.rectangleAroundPoint(centerX, centerY,
                                                  this.sideLengthX,
                                                  this.sideLengthY);
  var viewportSVG = this.pointsToSVGPolygonString(innerPolyPoints);
  var croptastic = this;
  var st;

  if (this.viewportElement !== null) {
    this.viewportElement.remove();
    this.viewportElement = null;
  }

  this.viewportElement = this.paper.path(viewportSVG).attr("fill",
                                                           "transparent");
  if (this.lr_handle !== null) {
    this.lr_handle.remove();
    this.lr_handle = null;
  }

  if (this.ur_handle !== null) {
    this.ur_handle.remove();
    this.ur_handle = null;
  }

  var viewport_ul_x =
        croptastic.viewportElement.matrix.x(croptastic.viewportElement.attrs.path[0][1],
                                            croptastic.viewportElement.attrs.path[0][2]);
  var viewport_ul_y =
        croptastic.viewportElement.matrix.y(croptastic.viewportElement.attrs.path[0][1],
                                            croptastic.viewportElement.attrs.path[0][2]);

  var viewport_ll_x =
        croptastic.viewportElement.matrix.x(croptastic.viewportElement.attrs.path[3][1],
                                            croptastic.viewportElement.attrs.path[3][2]);
  var viewport_ll_y =
        croptastic.viewportElement.matrix.y(croptastic.viewportElement.attrs.path[3][1],
                                            croptastic.viewportElement.attrs.path[3][2]);
  // Draw resize handles.
  this.lr_handle = this.drawResizeHandle(innerPolyPoints[2].x - (this.handle_side_length / 2),
                                         innerPolyPoints[2].y - (this.handle_side_length / 2),
                                         viewport_ul_x, viewport_ul_y);

  this.ur_handle = this.drawResizeHandle(innerPolyPoints[1].x - (this.handle_side_length / 2),
                                         innerPolyPoints[1].y + (this.handle_side_length / 2),
                                         viewport_ll_x, viewport_ll_y);

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

  st = this.paper.set();
  st.push(this.viewportElement, this.lr_handle, this.ur_handle);
  this.viewportElementAndHandlesSet = st;
  this.viewportElement.node.style.cursor = "-webkit-grabbing";
  this.lr_handle.node.style.cursor = "nwse-resize";
  this.ur_handle.node.style.cursor = "nesw-resize";
};

Croptastic.prototype.scaleViewport = function (newSideLengthX, newSideLengthY, x, y) {

  var multiplierX = newSideLengthX / this.sideLengthX;
  var multiplierY = newSideLengthY / this.sideLengthY;

  this.sideLengthX = newSideLengthX;
  this.sideLengthY = newSideLengthY;

  var scaleString = "S" + multiplierX + "," +
        multiplierY + "," + x + "," + y;
  this.viewportElement.transform("..." + scaleString);
  var newx = this.viewportElement.matrix.x(this.viewportElement.attrs.path[0][1],
                                           this.viewportElement.attrs.path[0][2]);
  var newy = this.viewportElement.matrix.y(this.viewportElement.attrs.path[0][1],
                                           this.viewportElement.attrs.path[0][2]);
  this.viewportCenterX = newx + (newSideLengthX / 2);
  this.viewportCenterY = newy + (newSideLengthY / 2);
};

Croptastic.prototype.moveInnerViewport = function (dx, dy) {
  var xformString = "T" + dx + "," + dy;
  this.viewportElementAndHandlesSet.transform("..." + xformString);
  this.updatePreview();
};

Croptastic.prototype.positionLRResizeHandle = function () {
  // General algorithm here is to look at the lower right of the
  // viewport, and subtract the handle side length.  The diffierence
  // between this new quantity and the original position of the lower
  // right handle is taken as the transform parameter (specifically,
  // the upper left corner of the lower right handle).
  var viewport_lr_x =
        this.viewportElement.matrix.x(this.viewportElement.attrs.path[2][1],
                                      this.viewportElement.attrs.path[2][2]);
  var viewport_lr_y =
        this.viewportElement.matrix.y(this.viewportElement.attrs.path[2][1],
                                      this.viewportElement.attrs.path[2][2]);
  var lr_handle_ul_x = this.lr_handle.matrix.x(this.lr_handle.attrs.path[0][1],
                                               this.lr_handle.attrs.path[0][2]);
  var lr_handle_ul_y = this.lr_handle.matrix.y(this.lr_handle.attrs.path[0][1],
                                               this.lr_handle.attrs.path[0][2]);
  var dx = viewport_lr_x - this.handle_side_length - lr_handle_ul_x;
  var dy = viewport_lr_y - this.handle_side_length - lr_handle_ul_y;
  var xformString = "T" + dx + "," + dy;
  this.lr_handle.transform("..." + xformString);
};

Croptastic.prototype.positionURResizeHandle = function () {
  var viewport_ur_x =
        this.viewportElement.matrix.x(this.viewportElement.attrs.path[1][1],
                                      this.viewportElement.attrs.path[1][2]);
  var viewport_ur_y =
        this.viewportElement.matrix.y(this.viewportElement.attrs.path[1][1],
                                      this.viewportElement.attrs.path[1][2]);
  var ur_handle_ll_x = this.ur_handle.matrix.x(this.ur_handle.attrs.path[3][1],
                                               this.ur_handle.attrs.path[3][2]);
  var ur_handle_ll_y = this.ur_handle.matrix.y(this.ur_handle.attrs.path[3][1],
                                               this.ur_handle.attrs.path[3][2]);
  var dx = viewport_ur_x - this.handle_side_length - ur_handle_ll_x;
  var dy = viewport_ur_y + this.handle_side_length - ur_handle_ll_y;
  var xformString = "T" + dx + "," + dy;
  this.ur_handle.transform("..." + xformString);
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
