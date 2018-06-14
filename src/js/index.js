/* global
   $
*/
'use strict';

require('webpack-jquery-ui');
require('webpack-jquery-ui/css');
import {Croptastic} from './croptastic.js';

let c = null;
$(document).ready(function() {
  let pictureUrl = '../images/crop-sample-pic.jpg';
  c = new Croptastic(document.getElementById('pic-crop-widget'),
                     document.getElementById('profile-picture-crop-preview'));
  c.setup(pictureUrl);
});
