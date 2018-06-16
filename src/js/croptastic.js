/* global $,require, Raphael */

let Raphael = require('raphael'); /* eslint no-unused-vars: 0 */

// Symbol representing upper left corner.
const UL = Symbol('upper-left');
// Symbol representing upper right corner.
const UR = Symbol('upper-right');
// Symbol representing lower right corner.
const LR = Symbol('lower-right');
// Symbol representing lower left corner.
const LL = Symbol('lower-left');
// Symbol representing center top position.
const CENTER_TOP = Symbol('center-top');
// Symbol representing center right position.
const CENTER_RIGHT = Symbol('center-right');
// Symbol representing center bottom position.
const CENTER_BOTTOM = Symbol('center-bottom');
// Symbol representing center left position.
const CENTER_LEFT = Symbol('center-left');

// 3 functions that let us abstract away the x/y offsets when
// calculating the x/y changes during drag.
let add = (a, b) => a + b;
let subtract = (a, b) => a - b;
let identity = (a) => a;
const propertiesForHandle = {
    [UL] : {
      'offset_x' : add,
      'offset_y' : add,
      'left_right_freedom' : true,
      'up_down_freedom' : true,
      'cursor' : 'nwse-resize',
      'raphael_corner_number' : 0
    },
    [UR] : {
      'offset_x' : subtract,
      'offset_y' : add,
      'left_right_freedom' : true,
      'up_down_freedom' : true,
      'cursor' : 'nesw-resize',
      'raphael_corner_number' : 1
    },
    [LR] : {
      'offset_x' : subtract,
      'offset_y' : subtract,
      'left_right_freedom' : true,
      'up_down_freedom' : true,
      'cursor' : 'nwse-resize',
      'raphael_corner_number' : 2
    },
    [LL] : {
      'offset_x' : add,
      'offset_y' : subtract,
      'left_right_freedom' : true,
      'up_down_freedom' : true,
      'cursor' : 'nesw-resize',
      'raphael_corner_number' : 3
    },
    [CENTER_TOP] : {
      'offset_x' : identity,
      'offset_y' : add,
      'left_right_freedom' : false,
      'up_down_freedom' : true,
      'cursor' : 'ns-resize'
    },
    [CENTER_RIGHT] : {
      'offset_x' : subtract,
      'offset_y' : identity,
      'left_right_freedom' : true,
      'up_down_freedom' : false,
      'cursor' : 'ew-resize'
    },
    [CENTER_BOTTOM] : {
      'offset_x' : identity,
      'offset_y' : subtract,
      'left_right_freedom' : false,
      'up_down_freedom' : true,
      'cursor' : 'ns-resize'
    },
    [CENTER_LEFT] : {
      'offset_x' : add,
      'offset_y' : identity,
      'left_right_freedom' : true,
      'up_down_freedom' : false,
      'cursor' : 'ew-resize'
    }
};

/**
 * Class representing a resize handle.  It's used at the 4 corners as
 * well as the mid points of each edge.
 */
class CroptasticResizeHandle {
  /**
   * Constructor for a resize handle.
   *
   * @param {Croptastic} croptastic A reference to the Croptastic
   * object.
   * @param {Object} viewport A reference to the Raphael viewport
   * object
   * @param {Symbol} position The position symbol for the handle.
   * @param {Number} handleSideLength The desired length of the side
   * of the resize handle.
   */
  constructor(croptastic, viewport,
              position,
              handleSideLength) {
    this.position = position;
    this.croptastic = croptastic;
    this.viewport = viewport;
    this.left_right_freedom =
      propertiesForHandle[this.position].left_right_freedom;
    this.up_down_freedom = propertiesForHandle[this.position].up_down_freedom;
    this.handleSideLength = handleSideLength;
    this.handle = null;
  }

  /**
   * Returns the center coordinate of this resize handle.
   * @return {Object} An object with x,y members indicating the
   * center.
   */
  resizeHandleCenterCoordinate() {
    const center = this.croptastic.positionCoordinates(this.position);
    let handleCenter = {};
    handleCenter.x = propertiesForHandle[this.position].offset_x(
      center.x,
      this.handleSideLength / 2);
    handleCenter.y = propertiesForHandle[this.position].offset_y(
      center.y,
      this.handleSideLength / 2);
    return handleCenter;
  }

  /**
   * Sets the cursor for this resize handle.
   *
   * @param {String} cursor Optional A cursor for when the mouse is
   * over the resize handle. If undefined, we use a default from the
   * dictionary of properties for each resize handle.
   */
  setHandleCursor(cursor) {
    if (cursor !== undefined) {
      this.handle.node.style.cursor = cursor;
    } else {
      this.handle.node.style.cursor = propertiesForHandle[this.position].cursor;
    }
  }

  /**
   * Draws the resize handle.
   */
  drawResizeHandle() {
    const handleCenter = this.resizeHandleCenterCoordinate();
    const handlePoints = squareAroundPoint(handleCenter.x, handleCenter.y,
                                          this.handleSideLength);
    const handleSvg = pointsToSVGPolygonString(handlePoints);
    this.handle =
      this.croptastic.paper.path(handleSvg)
      .attr('fill', '#949393').attr('opacity', '.7');
    this.setHandleCursor();

    this.handle.drag((dx, dy, mouseX, mouseY, e) => {
      // Convert mouse coordinates from browser (which are in the
      // browser window coordinates) to paper/picture coordinates, which
      // is what Raphael expects.
      let mouseXLocal = mouseX - this.croptastic.xoffset;
      let mouseYLocal = mouseY - this.croptastic.yoffset;

      let viewportSizeDx = 0;
      let viewportSizeDy = 0;

      let newSideLengthX = this.croptastic.sideLengthX;
      let newSideLengthY = this.croptastic.sideLengthY;
      // There is a UI issue here - by calculating based on the center
      // of the resize handle, there is a noticable visual artifact when
      // the user grabs the handle anywhere but the center of the handle
      // - the handle will "jump" as if the user had grabbed the center
      // of the LR.  Much time was spent trying to correct for this but
      // I had to move onto other things - it definitely should be
      // fixed, though.
      if (this.left_right_freedom) {
        let handleCenterX = this.handle.matrix.x(
          this.handle.attrs.path[0][1],
          this.handle.attrs.path[0][2]) + (this.handleSideLength / 2);
        viewportSizeDx = mouseXLocal - handleCenterX;
        if (this.position === UL ||
            this.position === LL ||
            this.position === CENTER_LEFT) {
          viewportSizeDx *= -1;
        }
        newSideLengthX += viewportSizeDx;
      }

      if (this.up_down_freedom) {
        let handleCenterY = this.handle.matrix.y(
          this.handle.attrs.path[0][1],
          this.handle.attrs.path[0][2]) + (this.handleSideLength / 2);
        viewportSizeDy = mouseYLocal - handleCenterY;
        if (this.position === UL ||
            this.position === UR ||
            this.position === CENTER_TOP) {
          viewportSizeDy *= -1;
        }
        newSideLengthY += viewportSizeDy;
      }

      // Prevent resize if the user has dragged the viewport to be too
      // small in both dimensions.
      if (newSideLengthX < this.croptastic.viewportSizeThreshold &&
          newSideLengthY < this.croptastic.viewportSizeThreshold) {
        return;
      }

      // If the user has only hit the minimum in one dimension, we can
      // still resize in the other dimension.
      if (newSideLengthX < this.croptastic.viewportSizeThreshold) {
        newSideLengthX = this.croptastic.viewportSizeThreshold;
      } else if (newSideLengthY < this.croptastic.viewportSizeThreshold) {
        newSideLengthY = this.croptastic.viewportSizeThreshold;
      }

      let scaleOrigin = this.croptastic.positionCoordinates(
        this.fixedCornerForSelf(this.position));
      let scaleOriginX = scaleOrigin.x;
      let scaleOriginY = scaleOrigin.y;
      this.croptastic.scaleViewport(newSideLengthX, newSideLengthY,
                                          scaleOriginX, scaleOriginY);
      this.croptastic.positionAllResizeHandles();

      this.croptastic.drawShadeElement();
      this.croptastic.updatePreview();
    }, (x, y, e) => {
      // We want the handle the user is dragging to move to the front,
      // because if the user drags over another resize handle, we want
      // our cursor to still be shown.
      this.handle.toFront();

      this.croptastic.setCursorsForResize(this.handle.node.style.cursor);
    }, (e) => {
      this.croptastic.setCursorsForResizeEnd();
    });
    this.handle.toFront();
  }

  /**
   * Helper method to return a "fixed corner" for this resize handle.
   * A fixed corner is a corner that doesn't move when using this
   * resize handle to resize the viewport.  (Generally the opposite
   * corner when using a corner resize handle, or, if using a resize
   * handle in the midpoint of an edge of the viewport, one of the
   * opposing two and it doesn't matter which one)
   *
   * @return {Symbol} One of the resize handle positions.
   */
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

  /**
   * Positions this resize handle according to current center after user drags.
   */
  positionHandle() {
    let newHandleCenter = this.resizeHandleCenterCoordinate();

    let currentHandleCenterX = this.handle.matrix.x(
      this.handle.attrs.path[0][1],
      this.handle.attrs.path[0][2]) + (this.handleSideLength / 2);
    let currentHandleCenterY = this.handle.matrix.y(
      this.handle.attrs.path[0][1],
      this.handle.attrs.path[0][2]) + (this.handleSideLength / 2);
    let pointDistanceX = newHandleCenter.x - currentHandleCenterX;
    let pointDistanceY = newHandleCenter.y - currentHandleCenterY;
    let xformString = 'T' + pointDistanceX + ',' + pointDistanceY;
    this.handle.transform('...' + xformString);
  }
}

/**
 * Main class for Croptastic.
 */
export class Croptastic {
  /**
   * Constructor for Croptastic instance.
   *
   * @param {HTMLElement} parentNode the main DIV where the image and
   * UI for cropping will be done. Will be cleared.
   * @param {HTMLCanvasElement?} previewNode A canvas element that the
   * preview will be drawn to. Can be null.
   */
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
    this.handleSideLength = 15;
    // The outer element that is shaded, to indicate to users which
    // parts of the image aren't currently included.
    this.shadeElement = null;
    // The event handlers give window-relative coordinates, so store
    // the origin of the paper (in window-coordinates) to subtract from
    // event handler coordinates.
    this.xoffset = null;
    this.yoffset = null;

    if (previewNode !== null &&
        previewNode.tagName.toLowerCase() !== 'canvas') {
      alert('Preview widget needs to be canvas');
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
    this.shadeElementFillColor = '#949393';
    this.shadeElementOpacity = 0.7;
  }

  /**
   * Once Croptastic is created, call setup() with the URL of the
   * image to be edited.
   *
   * @param {String} picUrl The URL fo the picture to the edited.
   */
  setup(picUrl) {
    this.parentNode.innerHTML = '';
    this.paper = Raphael(this.parentNode); /* eslint new-cap: 0 */
    let boundingRect = this.parentNode.getBoundingClientRect();
    this.xoffset = boundingRect.left + window.scrollX;
    this.yoffset = boundingRect.top + window.scrollY;
    this.width = boundingRect.width;
    this.height = boundingRect.height;
    this.svgImage = this.paper.image(picUrl, 0, 0, this.width, this.height);

    this.viewportCenterX = this.width / 2;
    this.viewportCenterY = this.height / 2;
    this.setupViewport();
    if (this.previewNode !== null) {
      this.imageForRaphaelSVGImage = document.createElement('IMG');
      this.imageForRaphaelSVGImage.src = this.svgImage.attr('src');
      this.drawingContext = this.previewNode.getContext('2d');
      this.previewWidth = $('#profile-picture-crop-preview').width();
      this.previewHeight = $('#profile-picture-crop-preview').height();
      this.updatePreview();
    }
    $(window).on('keydown', (ev) => {
      if (ev.originalEvent.key == 'e') {
        if (this.shadeElementOpacity == 0.7) {
          this.shadeElementOpacity = 1.0;
          this.shadeElementFillColor = '#000000';
        } else {
          this.shadeElementOpacity = 0.7;
          this.shadeElementFillColor = '#949393';
        }
        this.drawShadeElement();
      }
    });
  }

  /**
   * Internal function that is called during edit operations to update
   * the image preview.
   */
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
        this.imageForRaphaelSVGImage.width / this.svgImage.attr('width');
      if (this.widthMultiplier === 0) {
        this.widthMultiplier = null;
        return;
      }
    }

    if (this.heightMultiplier === null) {
      this.heightMultiplier =
        this.imageForRaphaelSVGImage.height / this.svgImage.attr('height');
      if (this.heightMultiplier === 0) {
        this.heightMultiplier = null;
        return;
      }
    }

    this.drawingContext.clearRect(0, 0, this.previewWidth, this.previewHeight);
    let imageCoordinateUlX =
          (this.viewportCenterX - (this.sideLengthX / 2))
          * this.widthMultiplier;
    let imageCoordinateUlY =
          (this.viewportCenterY - (this.sideLengthY / 2))
          * this.heightMultiplier;

    this.drawingContext.drawImage(
      this.imageForRaphaelSVGImage,
      imageCoordinateUlX, // start x
      imageCoordinateUlY, // start y
      this.sideLengthX * this.widthMultiplier, // width of source rect
      this.sideLengthY * this.heightMultiplier, // height of source rect
      0, 0, this.previewWidth, this.previewHeight); // destination rectangle
  }

  /**
   * Once the user has started resizing the viewport, this method is
   * called to set the cursor to indicate what's going on.
   *
   * @param {String} cursor A valid cursor string.
   */
  setCursorsForResize(cursor) {
    // We have to change the body cursor here because if we don't, the
    // browser will change the cursor to the non-drag one even if the
    // drag is ongoing while the mouse moves over another element.
    this.oldBodyCursor = document.getElementsByTagName('body')[0].style.cursor;
    document.getElementsByTagName('body')[0].style.cursor = cursor;
    this.oldViewportCursor = this.viewportElement.node.style.cursor;
    this.viewportElement.node.style.cursor = cursor;
    let i = 0;
    for (i = 0; i < this.resizeHandles.length; i++) {
      this.resizeHandles[i].setHandleCursor(cursor);
    }
  }

  /**
   * Once the user has stopped resizing the viewport, this method is
   * called to reset the cursor to normal.
   */
  setCursorsForResizeEnd() {
    document.getElementsByTagName('body')[0].style.cursor = this.oldBodyCursor;
    this.viewportElement.node.style.cursor = this.oldViewportCursor;
    for (let i = 0; i < this.resizeHandles.length; i++) {
      this.resizeHandles[i].setHandleCursor();
    }
  }

  /**
   * Get the position coordinates for a given resize handle position.
   *
   * @param {Symbol} position A valid position symbol for one of the
   * resize handles.
   *
   * @return {Object} A dictionary with x & y coordinates of the
   * position.
   */
  positionCoordinates(position) {
    let ul;
    let ur;
    let lr;
    let ll;
    switch (position) {
    case UL:
    case UR:
    case LR:
    case LL:
      return this.viewportCornerCoordinates(
        propertiesForHandle[position]['raphael_corner_number']);
    case CENTER_TOP:
      ul = this.positionCoordinates(UL);
      ur = this.positionCoordinates(UR);
      return {
        'x' : ur.x - ((ur.x - ul.x) / 2),
        'y' : ul.y
      };
    case CENTER_RIGHT:
      ur = this.positionCoordinates(UR);
      lr = this.positionCoordinates(LR);
      return {
        'x' : ur.x,
        'y' : lr.y - ((lr.y - ur.y) / 2)
      };
    case CENTER_BOTTOM:
      lr = this.positionCoordinates(LR);
      ll = this.positionCoordinates(LL);
      return {
        'x' : lr.x - ((lr.x - ll.x) / 2),
        'y' : ll.y
      };
    case CENTER_LEFT:
      ul = this.positionCoordinates(UL);
      ll = this.positionCoordinates(LL);
      return {
        'x' : ul.x,
        'y' : ll.y - ((ll.y - ul.y) / 2)
      };
    default:
      return null;
    }
  }

  /**
   * Get the coordinates for a given corner of the viewport.
   *
   * @param {Number} cornerNumber A valid corner number to get coordinates for.
   *
   * @return {Object} An object with x & y coordinates of the corner.
   */
  viewportCornerCoordinates(cornerNumber) {
    let pathElement = this.viewportElement.attrs.path[cornerNumber];
    return {
      'x' : this.viewportElement.matrix.x(pathElement[1],
                                         pathElement[2]),
      'y' : this.viewportElement.matrix.y(pathElement[1],
                                         pathElement[2])
    };
  }

  /**
   * Helper method to position all resize handles.
   */
  positionAllResizeHandles() {
    let i = 0;
    for (i = 0; i < this.resizeHandles.length; ++i) {
      this.resizeHandles[i].positionHandle();
    }
  }

  /**
   * Helper method to draw all resize handles.
   */
  drawResizeHandles() {
    let i = 0;
    for (i = 0; i < this.resizeHandles.length; ++i) {
      this.resizeHandles[i].drawResizeHandle();
    }
  }

  /**
   * Helper method to draw the entire viewport, including shade
   * element & set up event handles.
   */
  drawViewport() {
    let centerX = this.viewportCenterX;
    let centerY = this.viewportCenterY;
    let innerPolyPoints = rectangleAroundPoint(centerX, centerY,
                                               this.sideLengthX,
                                               this.sideLengthY);
    let viewportSVG = pointsToSVGPolygonString(innerPolyPoints);
    if (this.viewportElement !== null) {
      this.viewportElement.remove();
      this.viewportElement = null;
    }

    this.viewportElement = this.paper.path(viewportSVG).attr('fill',
                                                             'transparent');
    // Hack to make it work in Firefox, since it doesn't appear to send
    // mouse events to elements with no fill.  Works fine in
    // Chrome/Safari, though.
    $(this.viewportElement.node).css('pointer-events', 'visibleFill');
    // Draw resize handles.
    let handle = null;
    handle = new CroptasticResizeHandle(this,
                                        this.viewportElement,
                                        UL,
                                        this.handleSideLength);

    this.resizeHandles.push(handle);
    handle = new CroptasticResizeHandle(this,
                                        this.viewportElement,
                                        UR,
                                        this.handleSideLength);

    this.resizeHandles.push(handle);

    handle = new CroptasticResizeHandle(this,
                                        this.viewportElement,
                                        LR,
                                        this.handleSideLength);

    this.resizeHandles.push(handle);

    handle = new CroptasticResizeHandle(this,
                                        this.viewportElement,
                                        LL,
                                        this.handleSideLength);
    this.resizeHandles.push(handle);

    handle = new CroptasticResizeHandle(this,
                                        this.viewportElement,
                                        CENTER_TOP,
                                        this.handleSideLength);
    this.resizeHandles.push(handle);

    handle = new CroptasticResizeHandle(this,
                                        this.viewportElement,
                                        CENTER_RIGHT,
                                        this.handleSideLength);
    this.resizeHandles.push(handle);

    handle = new CroptasticResizeHandle(this,
                                        this.viewportElement,
                                        CENTER_BOTTOM,
                                        this.handleSideLength);
    this.resizeHandles.push(handle);

    handle = new CroptasticResizeHandle(this,
                                        this.viewportElement,
                                        CENTER_LEFT,
                                        this.handleSideLength);
    this.resizeHandles.push(handle);

    this.drawResizeHandles();

    // dx/dy from Raphael are the changes in x/y from the drag start,
    // not the most recent change of the mouse.  Since we want to
    // track the mouse cursor as the user moves it, we need to figure
    // out the change from the last drag event we got, not the start
    // of the drag.  We store the last x/y we've received in
    // Croptastic.last{x,y}.
    this.viewportElement.drag((dx, dy, x, y, e) => {
      let realDX = (x - this.lastx);
      let realDY = (y - this.lasty);
      this.viewportCenterX += realDX;
      this.viewportCenterY += realDY;
      this.lastx = x;
      this.lasty = y;
      this.moveInnerViewport(realDX, realDY);
      this.drawShadeElement();
    }, (x, y, e) => {
      this.lastx = x;
      this.lasty = y;
    });

    let st;
    st = this.paper.set();
    st.push(this.viewportElement);
    let i = 0;
    for (i = 0; i < this.resizeHandles.length; ++i) {
      st.push(this.resizeHandles[i].handle);
    }
    this.viewportElementAndHandlesSet = st;
    $(this.viewportElement.node).css('cursor', '-webkit-grabbing');
    $(this.viewportElement.node).css('cursor', '-moz-grabbing');
  }

  /**
   * Scales the viewport when the user is dragging a resize handle.
   *
   * @param {Number} newSideLengthX The new X side length
   * @param {Number} newSideLengthY The new Y side length
   * @param {Number} fixedPointX The fixed point X coordinate that
   * should not move
   * @param {Number} fixedPointY The fixed point Y coordinate that
   * should not move
   */
  scaleViewport(newSideLengthX, newSideLengthY, fixedPointX, fixedPointY) {
    let multiplierX;
    let multiplierY;
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

    let scaleString = 'S' + multiplierX + ',' +
        multiplierY + ',' + fixedPointX + ',' + fixedPointY;
    this.viewportElement.transform('...' + scaleString);
    let newPoint = this.positionCoordinates(UL);
    let newX = newPoint.x;
    let newY = newPoint.y;

    if (newSideLengthX) {
      this.viewportCenterX = newX + (newSideLengthX / 2);
    }
    if (newSideLengthY) {
      this.viewportCenterY = newY + (newSideLengthY / 2);
    }
  }

  /**
   * Called when user is dragging the inner viewport.
   *
   * @param {Number} dx The change in X the user has dragged the mouse.
   * @param {Number} dy The change in Y the user has dragged the mouse.
   */
  moveInnerViewport(dx, dy) {
    let xformString = 'T' + dx + ',' + dy;
    this.viewportElementAndHandlesSet.transform('...' + xformString);
    this.updatePreview();
  }


  /**
   * Helper function to draw the shade element.
   *
   */
  drawShadeElement() {
    if (this.shadeElement !== null) {
      this.shadeElement.remove();
      this.shadeElement = null;
    }
    let centerX = this.viewportCenterX;
    let centerY = this.viewportCenterY;

    let outerPolyPoints = [{'x' : 0, 'y' : 0},
                           {'x' : this.width, 'y' : 0},
                           {'x' : this.width, 'y' : this.height},
                           {'x' : 0, 'y' : this.height}];

    // Note the order of the points - it's required to go counter
    // clockwise with Raphael so that it considers this a subtraction
    // from the outer polygon.
    let innerPolyPoints = rectangleAroundPoint(centerX,
                                               centerY,
                                               this.sideLengthX,
                                               this.sideLengthY).reverse();

    let polySVG = pointsToSVGPolygonString(outerPolyPoints);
    polySVG += pointsToSVGPolygonString(innerPolyPoints);
    this.shadeElement = this.paper.path(polySVG)
      .attr('fill', this.shadeElementFillColor)
      .attr('opacity', this.shadeElementOpacity);
    this.shadeElement.toBack();
    this.svgImage.toBack();
  }

  /**
   * Helper method called upon setup to draw the shade element & viewport.
   */
  setupViewport() {
    this.drawShadeElement();
    this.drawViewport();
  }
}

/**
 * Converts points to a SVG polygon string.
 *
 * @param {Array<Object>} points An array of objects with x,y fields.
 *
 * @return {String} A SVG polygon string representing a path through
 * the points.
 */
function pointsToSVGPolygonString(points) {
  let svgstring = 'M' + points[0].x + ',' + points[0].y + ' ';
  let i = 0;
  for (i = 1; i < points.length; i += 1) {
    svgstring += 'L' + points[i].x + ',' + points[i].y + ' ';
  }
  svgstring += 'Z';
  return svgstring;
}

/**
 * Returns an array of points that represent a rectangle with sides
 * length sideLength{X,Y} around (x,y).  The points are returned in
 * clockwise order starting from the upper left.
 *
 * @param {Number} x The x-coordinate of the center
 * @param {Number} y The y-coordinate of the center
 * @param {Number} sideLengthX The length of the X side.
 * @param {Number} sideLengthY The length of the Y side.
 *
 * @return {Array<Object>} An array of points representing the 4
 * corners of the rectangle around the point.
 */
function rectangleAroundPoint(x, y, sideLengthX, sideLengthY) {
  let halfXSideLength = sideLengthX / 2;
  let halfYSideLength = sideLengthY / 2;
  return [
    {
      'x' : x - halfXSideLength, // upper left
      'y' : y - halfYSideLength
    },
    {
      'x' : x + halfXSideLength, // upper right
      'y' : y - halfYSideLength
    },
    {
      'x' : x + halfXSideLength, // lower right
      'y' : y + halfYSideLength
    },
    {
      'x' : x - halfXSideLength, // lower left
      'y' : y + halfYSideLength
    }
  ];
}

/**
 * Returns an array of points that represent a square with sides
 * length sideLength around (x,y).  The points are returned in
 * clockwise order starting from the upper left.
 *
 * @param {Number} x The x-coordinate of the center
 * @param {Number} y The y-coordinate of the center
 * @param {Number} sideLength The length of a side.
 *
 * @return {Array<Object>} An array of points representing the 4
 * corners of the square around the point.
 */
function squareAroundPoint(x, y, sideLength) {
  return rectangleAroundPoint(x, y, sideLength, sideLength);
}

