//*** GLOBALS ***

const base_server_url = "http://localhost:";
const server_port_num = 3000;

let drawMode = true; //whether in draw or select modes
let showWarnings = true; //whether or not to display warning messages
let showStitchInfo = false; //whether or not to display details about selected stitch
let saveFile = null; //used for saving pattern to .exp file

//used in both patternControl and canvasControl for detecting intersections/drawing
let pointRadius = 8;
let lineDetectTolerance = 3;

let patternControl = new PatternStateHx();
let canvasControl = new CanvasControl(document.getElementById("MainCanvas"),
			document.getElementById("ZoomSlider"));

//supports branching logic dependant on layer selection characteristics
const LAYER_SELECTION =
{
	"UNSELECTED":0,
	"EMPTY":1, //layer is selected but contains no stitches
	"SINGLE_PARTIAL":2, //one out of multiple stitches selected
	"MULTI_PARTIAL":3, //some but not all out of multiple stitches selected
	"SINGLE_FULL":4, //one an only stitch selected
	"MULTI_FULL":5,	 //all stitches in layer selected
};

const EXP_FILE_MAX_SIZE = 500; //bytes


//*** STITCH ***


function Stitch(x, y, selected)
{
	this.x = x;
	this.y = y;
	if (selected == true)
		this.selected = true;
	else
		this.selected = false;
	return this;	
};


//*** LAYER ***


//instantiate a new Layer by copy or from scratch if layerToCopy is null
function Layer(layerToCopy)
{
	this.stitches = [];
	this.selected = false; //flags layer selection (with or without selected stitches)
	this.selectedStitches = []; //list of any selected stitch indices
	if (layerToCopy === null)
	{
		this.r = 0;
		this.g = 0;
		this.b = 0;
	}
	else //deep copy other layer into this one
	{
		let i;
		for (i = 0; i < layerToCopy.stitches.length; ++i)
		{
			let s = layerToCopy.stitches[i];
			this.stitches.push(new Stitch(s.x, s.y, s.selected));
		}
		if (layerToCopy.selected == true)
			this.selected = true;
		for (i = 0; i < layerToCopy.selectedStitches.length; ++i)
			this.selectedStitches.push(layerToCopy.selectedStitches[i]);
		this.r = layerToCopy.r;
		this.g = layerToCopy.g;
		this.b = layerToCopy.b;	
	}
	return this;	
}


//deselects this layer and any selected stitches within
Layer.prototype.deselect = function()
{
	this.selected = false;
	for (let i = this.selectedStitches.length - 1; i >= 0; --i)
	{
		let selectedStitchIndex = this.selectedStitches[i];
		this.stitches[selectedStitchIndex].selected = false;
		this.selectedStitches.pop();
	}
}


Layer.prototype.selectStitch = function(stitchIndex)
{
	if (stitchIndex >= 0 && stitchIndex < this.stitches.length)
	{
		this.selected = true;
		this.stitches[stitchIndex].selected = true;

		//insert stitchIndex into correct sorted position in selectedStitches
		for (let i = 0; i < this.selectedStitches.length; ++i)
		{
			if (stitchIndex < this.selectedStitches[i])
			{
				this.selectedStitches.splice(i, 0, stitchIndex);
				return;
			}
			else if (stitchIndex == this.selectedStitches[i])
				return; //stitch already selected
		}
		this.selectedStitches.push(stitchIndex);
	}
}


Layer.prototype.selectAllStitches = function()
{
	//empty selected stitches list
	while (this.selectedStitches.length)
		this.selectedStitches.pop();
	//repopulate selected stitches/select all
	for (let i = 0; i < this.stitches.length; ++i)
	{
		this.selectedStitches.push(i);
		this.stitches[i].selected = true;
	}
	this.selected = true;
}


//marks this layer as selected and selects its last stitch, if any
Layer.prototype.selectLastStitch = function()
{
	this.selected = true; //select this layer, even if it contains no stitches
	this.selectStitch(this.stitches.length - 1); //no effect if out of range
}


//returns a a stitch index if coordinates intersect a stitch point, -1 otherwise
Layer.prototype.coordinatesOnStitchPoint = function(x, y)
{
	for (let i = 0; i < this.stitches.length; ++i)
	{
		let currentX = this.stitches[i].x;
		let currentY = this.stitches[i].y;
		let diffX = Math.abs(currentX - x);
		let diffY = Math.abs(currentY - y);
		let dist = Math.sqrt((diffX * diffX) + (diffY * diffY)); //a^2 + b^2 = c^2
		if (dist <= pointRadius)
			return i;
	}
	return -1;
}


//returns a a stitch index if coordinates intersect a stitch line, -1 otherwise
Layer.prototype.coordinatesOnStitchLine = function(x, y)
{
	if (this.stitches.length < 2)
		return - 1;
	let x2 = this.stitches[0].x;
	let y2 = this.stitches[0].y;
	for (let i = 1; i < this.stitches.length; ++i)
	{
		let x1 = x2;
		let y1 = y2;
		x2 = this.stitches[i].x;
		y2 = this.stitches[i].y;

		//a^2 + b^2 = c^2 (is distance from stitches[i - 1] to stitches[i])
		let diffX = Math.abs(x2 - x1);
		let diffY = Math.abs(y2 - y1);
		let dist1 = Math.sqrt((diffX * diffX) + (diffY * diffY));

		//a^2 + b^2 = c^2 (is distance from stitches[i - 1] to {x,y})
		diffX = Math.abs(x1 - x);
		diffY = Math.abs(y1 - y);
		let dist2 = Math.sqrt((diffX * diffX) + (diffY * diffY));

		//a^2 + b^2 = c^2 (is distance from stitches[i] to {x,y})
		diffX = Math.abs(x2 - x);
		diffY = Math.abs(y2 - y);
		let dist3 = Math.sqrt((diffX * diffX) + (diffY * diffY));

		if (dist2 + dist3 < dist1 + lineDetectTolerance)
			return i;
	}
	return -1; //no intersection found
}


//returns a member of LAYER_SELECTION to characterize any stitch selection
Layer.prototype.characterizeSelection = function()
{
	if (this.selected == false)
		return LAYER_SELECTION.UNSELECTED;
	else if (this.selectedStitches.length == 0)
		return LAYER_SELECTION.EMPTY;
	else if (this.selectedStitches.length == 1)
	{
		if (this.stitches.length == 1)
			return LAYER_SELECTION.SINGLE_FULL;
		else //this.stitches.length > 1
			return LAYER_SELECTION.SINGLE_PARTIAL;
	}
	else //this.selectedStitches.length > 1
	{
		if (this.selectedStitches.length == this.stitches.length)
			return LAYER_SELECTION.MULTI_FULL;
		else //this.selectedStitches.length < this.stitches.length
			return LAYER_SELECTION.MULTI_PARTIAL;
	}
}


//return true if this layer has same colors as otherLayer, false otherwise
Layer.prototype.sameColors = function(otherLayer)
{
	return (this.r == otherLayer.r && this.g == otherLayer.g
		&& this.b == otherLayer.b);
}


//writes this layer to buffer as a set of exp commands,
//returns {startIndex, startX, startY} with any advances
Layer.prototype.convertToEXP = function(writePackage)
{
	let buffer = writePackage.buffer;
	let i = writePackage.startIndex;
	let currentX = writePackage.startX;
	let currentY = writePackage.startY;
	let coeff = writePackage.scalingCoeff;
	let left = writePackage.leftBound;
	let top = writePackage.topBound;

	if (this.stitches.length == 0) //empty layer
		return {startIndex:i, startX:currentX, startY:currentY};

	//any/all jump(s) needed (e.g. to span a long distance between layers)
	let currentStitch = this.stitches[0];
	let nextX = Math.floor((currentStitch.x - left) * coeff);
	let nextY = Math.floor((currentStitch.y - top) * coeff);
	let jumpCoordinates = {startX:currentX, startY:currentY, endX:nextX, endY:nextY};
	i = writeEXP_Jumps(buffer, i, jumpCoordinates);
	if (i == -1)
		return null;

	currentX = JSON.parse(JSON.stringify(nextX));
	currentY = JSON.parse(JSON.stringify(nextY));

	//simple stitch in place for the first stitch of this layer 
	//(previously arrived to correct location by jump)
	i = writeEXP_Stitch(buffer, i, 0x00, 0x00);
	if (i == -1)
		return null;

	//remaining stitch actions, all that is needed is simple sequential stitches
	for (let k = 1; k < this.stitches.length; ++k) //indexes stitches in currentLayer
	{
		currentStitch = this.stitches[k];
		nextX = Math.floor((currentStitch.x - left) * coeff);
		nextY = Math.floor((currentStitch.y - top) * coeff);

		i = writeEXP_Stitch(buffer, i, nextX, nextY);
		if (i == -1)
			return null;

		currentX = JSON.parse(JSON.stringify(nextX));
		currentY = JSON.parse(JSON.stringify(nextY));
	}
	return {startIndex:i, startX:currentX, startY:currentY}; 
}


//*** PATTERN ***


//instantiate a new Pattern by copy or from scratch if patternToCopy is null
function Pattern(patternToCopy)
{
	this.layers = [];
	if (patternToCopy != null)
	{
		for	(let i = 0; i < patternToCopy.layers.length; ++i)
			this.layers.push(new Layer(patternToCopy.layers[i]));
	}
	return this;
};


//deselects every layer and stitch in the pattern
Pattern.prototype.deselectAll = function()
{
	for (let i = this.layers.length - 1; i >= 0; --i)
	{
		if (this.layers[i].selected == true)
			this.layers[i].deselect();
	}
}


//selects a layer without selecting any stitches
Pattern.prototype.selectLayer = function(layerIndex)
{
	if (layerIndex >= 0 && layerIndex < this.layers.length)
		this.layers[layerIndex].selected = true;
}


//selects a layer and a contained stitch by index
Pattern.prototype.selectSingleStitch = function(layerIndex, stitchIndex)
{
	if (layerIndex >= 0 && layerIndex < this.layers.length)
		this.layers[layerIndex].selectStitch(stitchIndex);
}


//selects a layer and it's last stitch, if any
Pattern.prototype.selectLastStitchOfLayer = function(layerIndex)
{
	if (layerIndex >= 0 && layerIndex < this.layers.length)
		this.layers[layerIndex].selectLastStitch();
}


//returns info about any intersection of coordinates, null if no intersection
Pattern.prototype.checkCoordinatesForIntersection = function(x, y)
{
	let i;
	let temp;

	//check for stitch point intersections
	for (i = 0; i < this.layers.length; ++i)
	{
		temp = this.layers[i].coordinatesOnStitchPoint(x, y);
		if (temp != -1) //a stitch index was returned
			return [0, temp, i]; //[0 for stitchpoint, stitch index, layer index]
	}

	//check for stitch point intersections
	for (i = 0; i < this.layers.length; ++i)
	{
		temp = this.layers[i].coordinatesOnStitchLine(x, y);
		if (temp != -1) //a stitch index was returned
			return [1, temp, i]; //[1 for stitchline, stitch index, layer index]
	}
	return null; //no intersection
}


Pattern.prototype.countSelectedStitches = function()
{
	let count = 0;
	for (let i = 0; i < this.layers.length; ++i)
		count += this.layers[i].selectedStitches.length;
	return count;
}


Pattern.prototype.countSelectedLayers = function()
{
	let count = 0;
	for (let i = 0; i < this.layers.length; ++i)
	{
		if (this.layers[i].selected == true)
			++count;
	}
	return count;
}


//deletes (and deselects) all selected stitches/layers
//returns index of the layer to be auto-selected after deletion (-1 if none)
Pattern.prototype.deleteSelected = function()
{
	let returnLayerIndex = -1;
	for (let i = this.layers.length - 1; i >= 0; --i)
	{
		let layer = this.layers[i];
		let ls = layer.characterizeSelection();
		if (ls == LAYER_SELECTION.UNSELECTED)
			continue;
		
		if (ls == LAYER_SELECTION.EMPTY_LAYER || ls == LAYER_SELECTION.SINGLE_FULL
					|| ls == LAYER_SELECTION.MULTI_FULL)
		{
			this.layers.splice(i, 1);
			if (returnLayerIndex != -1)
				--returnLayerIndex;
		}
		else //SINGLE_PARTIAL or MULTI_PARTIAL selection
		{
			layer.selected = false;
			while (layer.selectedStitches.length > 0)
				layer.stitches.splice(layer.selectedStitches.pop(), 1);
			if (returnLayerIndex == -1)
				returnLayerIndex = i;
		}
	}
	if (returnLayerIndex == -1 && this.layers.length > 0)
		returnLayerIndex = this.layers.length - 1;
	return returnLayerIndex;
}


//returns index of last layer with any selection, -1 if none
Pattern.prototype.getLastSelectedLayerIndex = function()
{
	for (let i = this.layers.length - 1; i >= 0; --i)
	{
		if (this.layers[i].selected == true)
			return i;
	}
	return -1;
}


Pattern.prototype.moveAllSelected = function(changeX, changeY)
{
	for (let i = 0; i < this.layers.length; ++i)
	{
		for (let j = 0; j < this.layers[i].selectedStitches.length; ++j)
		{
			let s = this.layers[i].stitches[this.layers[i].selectedStitches[j]];
			s.x += changeX;
			s.y += changeY;
		}
	}
}


//deselects any current selection and reselects any stitches within rectangular dimensions
Pattern.prototype.reselectAllWithinBox = function(topLeftX, topLeftY, bottomRightX, bottomRightY)
{
	this.deselectAll();
	for (let i = 0; i < this.layers.length; ++i)
	{
		for (let j = 0; j < this.layers[i].stitches.length; ++j)
		{
			let s = this.layers[i].stitches[j];
			if (s.x >= topLeftX && s.x <= bottomRightX && s.y >= topLeftY && s.y <= bottomRightY)
				this.selectSingleStitch(i, j);
		}
	}
}


Pattern.prototype.findLeft = function()
{
	let left = null;
	for (let i = 0; i < this.layers.length; ++i)
	{
		for (j = 0; j < this.layers[i].stitches.length; ++j)
		{
			s = this.layers[i].stitches[j];
			if (left === null) //first stitch of the pattern
				left = s.x;
			else if (s.x < left)
				left = s.x;
		}
	}
	return left;	
}


Pattern.prototype.findTop = function()
{
	let top = null;
	for (let i = 0; i < this.layers.length; ++i)
	{
		for (j = 0; j < this.layers[i].stitches.length; ++j)
		{
			s = this.layers[i].stitches[j];
			if (top === null) //first stitch of the pattern
				top = s.y;
			else if (s.y < top)
				top = s.y;				
		}
	}
	return top;	
}


//returns the maximum single dimensional change (x or y axis)
//between any two stitches in same layer
Pattern.prototype.findMaxStitchChangeXY = function()
{
	let maxChange = 0;
	for (let i = 0; i < this.layers.length; ++i)
	{
		if (this.layers[i].stitches.length < 2)
			continue;
		let lastStitch = this.layers[i].stitches[0];
		for (j = 1; j < this.layers[i].stitches.length; ++j)
		{
			let currentStitch = this.layers[i].stitches[j];		
			let changeX = Math.abs(currentStitch.x - lastStitch.x);
			let changeY = Math.abs(currentStitch.y - lastStitch.y);
			if (changeX > maxChange)
				maxChange = changeX;
			if (changeY > maxChange)
				maxChange = changeY;
			lastStitch = currentStitch;
		}
	}
	return maxChange;	
}


//returns an array of byte commands in .exp format, null for error
//stitchMax sets scale (represents max change in either x or y dimension)
Pattern.prototype.convertToEXP = function(stitchMax)
{
	if (stitchMax < 1 || stitchMax > 127)
		return null;

	let left = this.findLeft();
	let top = this.findTop();
	let maxChange = this.findMaxStitchChangeXY();

	if (left === null || maxChange === 0)
		return null; //no stitches in pattern, or any/all stitches on a single point

	//used to reduce stitch x and y change values to within stitchMax parameter
	let coeff = stitchMax / maxChange;
	if (coeff > 1)
		coeff = 1;

	//main loop to create .exp commands
	let i = 0; //indexes commands array
	let commands = new Int8Array(EXP_FILE_MAX_SIZE);
	let lastLayer = null;
	let currentX = 0;
	let currentY = 0;
	for (let j = 0; j < this.layers.length; ++j)
	{
		let currentLayer = this.layers[j];
		if (currentLayer.stitches.length == 0)
			continue; //skip empty layers

		//after first layer, add stop/color change if needed
		if (j > 0 && currentLayer.sameColors(lastLayer) == false)
		{
			i = writeEXP_ColorChangeStop(commands, i);
			if (i == -1)
				return null;
		}

		let paramPackage = {buffer:commands, startIndex:i,
					startX:currentX, startY:currentY, scalingCoeff:coeff,
					leftBound:left, topBound:top};
		let returnPackage = currentLayer.convertToEXP(paramPackage);
		if (returnPackage == null)
			return null;
		i = returnPackage.startIndex;
		currentX = returnPackage.startX;
		currentY = returnPackage.startY;

		lastLayer = currentLayer;
	}

	if (i < EXP_FILE_MAX_SIZE)
		return commands.subarray(0, i);
	else
		return commands;
}


//*** PATTERNSTATEHX ***


//stores pattern states to support undo/redo functionality
function PatternStateHx()
{
	this.maxStates = 5;
	this.states = [new Pattern()];
	this.stateIndex = 0;
	return this;
};


//returns reference to the current active pattern in states
PatternStateHx.prototype.getActivePatternState = function()
{
	return this.states[this.stateIndex];
}


PatternStateHx.prototype.canRevertBack = function()
{
	return (this.stateIndex > 0);
}


PatternStateHx.prototype.canRevertForward = function()
{
	return (this.stateIndex < this.states.length - 1);
}


//pushes a copy of the active pattern state in states and returns a reference
PatternStateHx.prototype.pushPatternStateClone = function()
{
	if (this.canRevertForward() == true) //delete any later saved pattern states
	{
		while (this.states.length > this.stateIndex + 1)
			this.states.pop();
	}

	//push a clone of the current active pattern state
	let oldPatternState = this.getActivePatternState();
	this.states.push(new Pattern(oldPatternState)); //copy old pattern state into a new one
	this.stateIndex += 1;

	if (this.states.length > this.maxStates) //too many states, remove the oldest
	{
		this.states.splice(0, 1);
		this.stateIndex -= 1;
	}

	return this.getActivePatternState();
}


//reverts back one state, if possible, and returns the active pattern state
PatternStateHx.prototype.revertBack = function()
{
	if (this.canRevertBack() == true)
		this.stateIndex -= 1;
	return this.getActivePatternState();
}


//reverts forward one state, if possible, and returns the active pattern state
PatternStateHx.prototype.revertForward = function()
{
	if (this.canRevertForward() == true)
		this.stateIndex += 1;
	return this.getActivePatternState();
}


//*** CANVASCONTROL ***


function CanvasControl(canvasElement, zoomSliderElement)
{
	this.canvas = canvasElement; //reference to DOM canvas element

	//zoom controls
	this.magMax = 5; //e.g. 5X larger
	this.ticksPerMag = 2;
	this.zoomValue = 0;

	//initial setup of the zoom slider input DOM element
	this.zoomSlider = zoomSliderElement; //reference to DOM slider input
	this.zoomSlider.min = 0;
	this.zoomSlider.max = this.magMax * this.ticksPerMag;
	this.zoomSlider.value = this.zoomValue * 1;

	this.lastHeldX = -1;
	this.lastHeldY = -1;
	
	this.selectionSquare = //tracks user-drawn selection square on the canvas
	{
		exists:false,
		origin: {x: -1, y: -1},
		topLeft: {x: -1, y: -1},
		bottomRight: {x: -1, y: -1}
	};

	return this;
};


//returns a coefficient used in zoom-scaled coordinate calculations
CanvasControl.prototype.getZoomScalingCoeff = function()
{
	return 1 + (this.zoomValue / this.ticksPerMag);
}


CanvasControl.prototype.refreshCanvasSize = function()
{
	let scalingCoeff = this.getZoomScalingCoeff();
	
	//1000 px X 1500 px are set as canvas element h, w in index.html
	this.canvas.height = 1000 * scalingCoeff;
	this.canvas.width = 1500 * scalingCoeff
}


//activates/marks the origin and initial bounds of selection square
CanvasControl.prototype.openSelectionSquare = function(startX, startY)
{
	this.selectionSquare.exists = true;
	this.selectionSquare.origin.x = startX;
	this.selectionSquare.origin.y = startY;
	this.selectionSquare.topLeft.x = startX;
	this.selectionSquare.topLeft.y = startY;
	this.selectionSquare.bottomRight.x = startX;
	this.selectionSquare.bottomRight.y = startY;
}


CanvasControl.prototype.drawingSelectionSquare = function()
{
	return (this.selectionSquare.exists == true);
}


CanvasControl.prototype.resizeSelectionSquare = function(cursorX, cursorY)
{
	if (cursorX > this.selectionSquare.origin.x)
	{
		this.selectionSquare.topLeft.x = this.selectionSquare.origin.x;
		this.selectionSquare.bottomRight.x = cursorX;			
	}
	else //cursorX <= this.selectionSquare.origin.x
	{
		this.selectionSquare.topLeft.x = cursorX;
		this.selectionSquare.bottomRight.x = this.selectionSquare.origin.x;
	}
	if (cursorY > this.selectionSquare.origin.y)
	{
		this.selectionSquare.topLeft.y = this.selectionSquare.origin.y;
		this.selectionSquare.bottomRight.y = cursorY;
	}
	else //cursorY <= this.selectionSquare.origin.y)
	{
		this.selectionSquare.topLeft.y = cursorY;
		this.selectionSquare.bottomRight.y = this.selectionSquare.origin.y;
	}	
}


//marks selection square as non-existent and returns final bounding coordinates
CanvasControl.prototype.closeSelectionSquare = function()
{
	let tlx = this.selectionSquare.topLeft.x;
	let tly = this.selectionSquare.topLeft.y;
	let brx = this.selectionSquare.bottomRight.x;
	let bry = this.selectionSquare.bottomRight.y;
	this.selectionSquare.exists = false;
	return {tlx, tly, brx, bry};
}


//used when a stitch(es) is/are grabbed/held/moved with the cursor
//returns the change in coordinates {changeX, changeY}
CanvasControl.prototype.moveLastHeld = function(heldX, heldY)
{
	let x = heldX - this.lastHeldX; //change in x from last position
	let y = heldY - this.lastHeldY; //change in y from last position
	this.lastHeldX = heldX;
	this.lastHeldY = heldY;
	return {x, y};
}


//used when held stitches are released
CanvasControl.prototype.releaseLastHeld = function()
{
	this.lastHeldX = -1;
	this.lastHeldY = -1;
}


//returns true if cursor is holding/moving one or more stitches, false otherwise
CanvasControl.prototype.holdingStitches = function()
{
	return (this.lastHeldX != -1);
}


CanvasControl.prototype.clearCanvas = function()
{
	let context = this.canvas.getContext('2d');

	//copied from https://stackoverflow.com/questions/2142535/how-to-clear-the-canvas-for-redrawing
	context.clearRect(0, 0, this.canvas.width, this.canvas.height);
}


//draws a stitch point enclosed by a circle on the canvas
CanvasControl.prototype.drawStitchPoint = function(stitch, rgbString)
{
	let context = this.canvas.getContext('2d');
	let scalingCoeff = this.getZoomScalingCoeff();
	let drawX = stitch.x * scalingCoeff;
	let drawY = stitch.y * scalingCoeff;

	context.beginPath();
	context.moveTo(drawX, drawY);
	if (stitch.selected == true)
		context.lineWidth = 4;
	else //stitch.selected == false
		context.lineWidth = 1;	
	context.arc(drawX, drawY, pointRadius, 0, 2 * Math.PI); //start point circle
	context.strokeStyle = rgbString;
	context.stroke();
}


//draws a stitch line between two stitch points on the canvas
CanvasControl.prototype.drawStitchLine = function(stitch1, stitch2, rgbString)
{
	let context = this.canvas.getContext('2d');
	let scalingCoeff = this.getZoomScalingCoeff();
	let drawX1 = stitch1.x * scalingCoeff;
	let drawY1 = stitch1.y * scalingCoeff;
	let drawX2 = stitch2.x * scalingCoeff;
	let drawY2 = stitch2.y * scalingCoeff;

	context.beginPath();
	context.moveTo(drawX1, drawY1);
	if (stitch2.selected == true)
		context.lineWidth = 4;
	else //stitch2.selected == false
		context.lineWidth = 1;
	context.lineTo(drawX2, drawY2); //stitch line
	context.strokeStyle = rgbString;	
	context.stroke();
}


//draws a full pattern (all stitch points/stitch lines) to the canvas
CanvasControl.prototype.drawPattern = function(pattern)
{
	for (let j = 0; j < pattern.layers.length; ++j)
	{
		let currentLayer = pattern.layers[j];
		if (currentLayer.stitches.length == 0)
			continue;
		let rgbString = "rgb(" + currentLayer.r + ", " + currentLayer.g + ", " + currentLayer.b + ")";
		let sp1 = currentLayer.stitches[0];
		this.drawStitchPoint(sp1, rgbString); //draw the first stitch point
		
		//draw subsequent stitch lines and stitchpoints
		for (let i = 1; i < currentLayer.stitches.length; ++i)
		{
			let sp2 = currentLayer.stitches[i];
			this.drawStitchLine(sp1, sp2, rgbString);
			this.drawStitchPoint(sp2, rgbString);
			sp1 = sp2;
		}
	}
}


//draws a user-created selection square to the canvas
CanvasControl.prototype.drawSelectionSquare = function()
{
	if (this.selectionSquare.exists == false)
		return;

	let scalingCoeff = this.getZoomScalingCoeff();
	let x = this.selectionSquare.topLeft.x * scalingCoeff;
	let y = this.selectionSquare.topLeft.y * scalingCoeff;	
	let width = (this.selectionSquare.bottomRight.x * scalingCoeff) - x;
	let height = (this.selectionSquare.bottomRight.y * scalingCoeff) - y;

	let context = this.canvas.getContext('2d');
	context.beginPath();
	context.setLineDash([5, 15]);
	context.lineWidth = 1;
	context.strokeStyle = "rgb(0, 0, 0)"; //black
	context.rect(x, y, width, height);
	context.stroke()
}


//fully redraws everything in the canvas
CanvasControl.prototype.refreshCanvas = function()
{
	this.refreshCanvasSize();
	this.clearCanvas();
	let p = patternControl.getActivePatternState();
	this.drawPattern(p);
	this.drawSelectionSquare();
}

CanvasControl.prototype.changeZoom = function(zoomVal)
{
	if (zoomVal >= 0 && zoomVal <= (this.magMax * this.ticksPerMag))
		this.zoomValue = zoomVal;
}


CanvasControl.prototype.refreshZoomSlider = function()
{
	//trying to be extra careful not to load value as a reference
	this.zoomSlider.value = this.zoomValue * 1;
}


//***FULL PAGE REFRESH METHODS***


//remove all rows currently in the layer table
function emptyLayerTable(layerTableElement)
{
	let row = layerTableElement.lastElementChild; 
	while (row)
	{
		layerTableElement.removeChild(row);
		row = layerTableElement.lastElementChild;
	}
}


//converts rgb int values to a hex string formatted as "#RRGGBB"
function getRGBHexString(r, g, b)
{
	let strR = r.toString(16);
	if (strR.length < 2)
		strR = "0" + strR; 
	let strG = g.toString(16);
	if (strG.length < 2)
		strG = "0" + strG; 
	let strB = b.toString(16);
	if (strB.length < 2)
		strB = "0" + strB; 
	return "#" + strR + "" + strG + "" + strB;
}


//create layer table dom elements for each pattern layer
function refreshLayerTable()
{
	let layerTable = document.getElementById("LayerTable");
	emptyLayerTable(layerTable);

	let p = patternControl.getActivePatternState();
	for (let i = 0; i < p.layers.length; ++i)
	{
		row = document.createElement("tr");
		layerTable.appendChild(row);
		row.style.cursor = "pointer";
		
		let col = document.createElement("td");
		row.appendChild(col);
		col.innerHTML = "Layer " + (i + 1);
		col.addEventListener("click", function(evnt)
		{
			layerTableClickListener(evnt);
		});

		//display a color picker for this selected layer
		if (p.layers[i].selected == true)
		{
			row.style.border = "solid";
			
			col = document.createElement("td");
			row.appendChild(col);
			let colorPicker = document.createElement("input");
			colorPicker.type = "color";
			colorPicker.style.cursor = "pointer";
			col.appendChild(colorPicker);
			colorPicker.value = getRGBHexString(p.layers[i].r, p.layers[i].g, p.layers[i].b);

			colorPicker.addEventListener("change", function(evnt)
			{	
				layerColorPickerChangeListener(evnt);
			});
		}
	}
}


function getStitchInfoString()
{
	let p = patternControl.getActivePatternState();
	let selectedCount = p.countSelectedStitches();
	let contentStr = "error: getStitchInfoString";
	if (selectedCount == 0)
		contentStr = "(no stitch selection)";
	else if (selectedCount > 1)
		contentStr = "(multiple stitch selections)"
	else //single stitch selected
	{
		for (let i = 0; i < p.layers.length; ++i)
		{
			let layer = p.layers[i];
			if (layer.selectedStitches.length == 1)
			{
				let stitchIndex = layer.selectedStitches[0];
				let s = layer.stitches[stitchIndex];
				contentStr = "layer: " + i;
				contentStr = contentStr + ", stitch: " + stitchIndex;
				contentStr = contentStr + ", x coord: " + s.x;
				contentStr = contentStr + ", y coord: " + s.y;
				contentStr = contentStr + ", color: " + getRGBHexString(layer.r, layer.g, layer.b);
				break;
			}
		}
	}
	return contentStr;
}


//populates and shows or hides the stitch info span in index.html
function refreshStitchInfo()
{
	let stitchInfoSpan = document.getElementById("StitchInfoSpan");
	if (showStitchInfo == true)
	{
		stitchInfoSpan.innerHTML = getStitchInfoString();
		stitchInfoSpan.hidden = false;
	}
	else
		stitchInfoSpan.hidden = true;
}


//main page refresh function, used in many event listeners
function refreshWholePage()
{	
	//refresh zoom slider input's value
	canvasControl.refreshZoomSlider();
	
	//refresh canvas dimensions, and redraw pattern, any selection square
	canvasControl.refreshCanvas();

	//update list of layers w/ names/color inputs
	refreshLayerTable();

	//set value of the stitch info switch based on global variable
	let stitchInfoSwitch = document.getElementById("StitchInfoSwitch");
	stitchInfoSwitch.checked = showStitchInfo;

	//update span with extra info about any selected stitch
	refreshStitchInfo();

	//update the mode switch
	let modeSwitch = document.getElementById("ModeSwitch");
	if (drawMode == true)
		modeSwitch.checked = true;
	else
		modeSwitch.checked = false;

	//enable/disable undo and redo buttons
	document.getElementById("UndoButton").disabled = !patternControl.canRevertBack();
	document.getElementById("RedoButton").disabled = !patternControl.canRevertForward();
}


//*** OTHER VARIOUS METHODS ***


function deleteSelectedOnPage()
{
	let p = patternControl.getActivePatternState();
	let stitchCount = p.countSelectedStitches();
	let layerCount = p.countSelectedLayers();
	if (stitchCount == 0 && layerCount == 0)
		return; //nothing to delete
	if (showWarnings == true)
	{
		let warningMessage = "You are about to delete selected " + stitchCount;
		warningMessage = warningMessage + " stitch(es) in " + layerCount;
		warningMessage = warningMessage + " layer(s). Proceed?";
		if (confirm(warningMessage) == false)
			return;
	}

	p = patternControl.pushPatternStateClone(); //save current pattern state, returns new clone
	let layerIndex = p.deleteSelected();
	if (drawMode == true && layerIndex != -1) //make a new terminal selection in draw mode
		p.selectLastStitchOfLayer(layerIndex);
	refreshWholePage();

	if (showWarnings == true)
		showWarnings = confirm("Continue receiving warning messages?");
}


function addLayerOnPage()
{
	let p = patternControl.pushPatternStateClone();
	p.layers.push(new Layer(null));
	p.deselectAll();
	p.selectLastStitchOfLayer(p.layers.length - 1);
	refreshWholePage();
}


//returns {x,y} coordinates of a mouse event, adjusted for zoom
//adapted from https://stackoverflow.com/questions/55677/how-do-i-get-the-coordinates-of-a-mouse-click-on-a-canvas-element
//and from https://stackoverflow.com/questions/17130395/real-mouse-position-in-canvas
function getCoordinatesOfMouseEvent(evnt)
{
	let c = document.getElementById("MainCanvas");
	let rectangle = c.getBoundingClientRect();
	let scaleCoeff = canvasControl.getZoomScalingCoeff();
	let x = ((evnt.clientX - rectangle.left) * c.width) / (rectangle.right - rectangle.left) / scaleCoeff;
	let y = ((evnt.clientY - rectangle.top) * c.height) / (rectangle.bottom - rectangle.top) / scaleCoeff;
	return {x,y};
}


//*** WRITE EXP METHODS ***


function forceExpRange(byteValue)
{
	if (byteValue > 127)
		return 127;
	else if (byteValue < -127)
		return -127;
	else
		return byteValue * 1; //just to avoid a reference copy
}

//writes a color change stop command to exp file buffer
//returns -1 if insufficient buffer space, next startIndex otherwise
function writeEXP_ColorChangeStop(buffer, startIndex)
{
	if (startIndex + 3 >= EXP_FILE_MAX_SIZE)
		return -1; //insufficent remaining buffer space
	buffer[startIndex] = 0x80;
	buffer[startIndex + 1] = 0x01;
	buffer[startIndex + 2] = 0x00;
	buffer[startIndex + 3] = 0x00;
	return startIndex + 4;
}


//writes a jump command to exp file buffer
//returns -1 if insufficient buffer space, next startIndex otherwise
function writeEXP_Jump(buffer, startIndex, jumpX, jumpY)
{
	if (startIndex + 3 >= EXP_FILE_MAX_SIZE)
		return -1; //insufficent remaining buffer space

	//range validation
	jumpX = forceExpRange(jumpX);
	jumpY = forceExpRange(jumpY);

	buffer[startIndex] = 0x80;
	buffer[startIndex + 1] = 0x04;
	buffer[startIndex + 2] = jumpX;
	buffer[startIndex + 3] = jumpY;
	return startIndex + 4;	
}


//continuously writes jump commands to exp file buffer
//till jumping all the way from start coordinates to end coordinates
//returns -1 for error
function writeEXP_Jumps(buffer, startIndex, coordinates)
{
	let curX = coordinates.startX;
	let curY = coordinates.startY;
	let changeX;
	let changeY;
	while (curX != coordinates.endX || curY != coordinates.endY)
	{
		changeX = forceExpRange(coordinates.endX - curX);
		curX += changeX;
		changeY = forceExpRange(coordinates.endY - curY)
		curY += changeY;
		startIndex = writeEXP_Jump(buffer, startIndex, changeX, changeY)
		if (startIndex == -1)
			return -1; //insufficent remaining buffer space
	}
	return startIndex * 1; //just to avoid a reference copy
}

//writes a stitch command to exp file buffer
//returns -1 if insufficient buffer space, next startIndex otherwise
function writeEXP_Stitch(buffer, startIndex, stitchX, stitchY)
{
	if (startIndex + 1 >= EXP_FILE_MAX_SIZE)
		return -1; //insufficent remaining buffer space

	//range validation
	stitchX = forceExpRange(stitchX);
	stitchY = forceExpRange(stitchY);

	buffer[startIndex] = stitchX;
	buffer[startIndex + 1] = stitchY;
	return startIndex + 2;	
}


//***EVENT LISTENERS***


//listener for dynamically added layer rows in the layer table
function layerTableClickListener(evnt)
{
	//clicked element is <td>, parent expected to be <tr>
	let rowIndex = 0;
	let currentRow = evnt.target.parentElement;
	while (currentRow.previousElementSibling)
	{
		currentRow = currentRow.previousElementSibling;
		++rowIndex;
	}			

	let p = patternControl.getActivePatternState();
	p.deselectAll();
	if (drawMode == true)
		p.selectLastStitchOfLayer(rowIndex); //select the last stitch in the layer
	else //select mode
		p.layers[rowIndex].selectAllStitches();
	refreshWholePage();	
}


//listener for dynamically added layer color picker in the layer table
//adapted from https://stackoverflow.com/questions/58184508/html5-input-type-color-read-single-rgb-values
function layerColorPickerChangeListener(evnt)
{	
	//changed element is <input>, parent expected to be <td>, parent of parent expected to be <tr>
	let colorInput = evnt.target;
	let rowIndex = 0;
	let currentRow = colorInput.parentElement.parentElement;
	while (currentRow.previousElementSibling)
	{
		currentRow = currentRow.previousElementSibling;
		++rowIndex;
	}	
	
	let p = patternControl.pushPatternStateClone(); //save state and return clone
	let layer = p.layers[rowIndex];
	let colorStr = colorInput.value;
	layer.r = parseInt(colorStr.substr(1,2), 16);
	layer.g = parseInt(colorStr.substr(3,2), 16);
	layer.b = parseInt(colorStr.substr(5,2), 16);
	refreshWholePage();
}


//add/select mode checkbox event listener
document.getElementById("ModeSwitch").addEventListener("change", function()
{
	let modeSwitch = document.getElementById("ModeSwitch");
	drawMode = modeSwitch.checked;
	if (drawMode == true) //switched from select mode to draw mode
	{
		let p = patternControl.getActivePatternState();
		let layerIndex = p.getLastSelectedLayerIndex();
		if (layerIndex != -1) //a selection exists
		{
			p.deselectAll();
			p.selectLastStitchOfLayer(layerIndex);
		}
		else if (p.layers.length > 0) //a layer exists which can be selected
			p.selectLastStitchOfLayer(p.layers.length - 1);

	}
	refreshWholePage();
});


//stitch info checkbox event listener
document.getElementById("StitchInfoSwitch").addEventListener("change", function()
{
	//update global variable and refresh
	let showInfoSwitch = document.getElementById("StitchInfoSwitch");
	if (showInfoSwitch.checked == true)
		showStitchInfo = true;
	else
		showStitchInfo = false;
	refreshWholePage();
});


//listener for ctrl-mousewheel on the main canvas
document.getElementById("MainCanvas").addEventListener("wheel", function(evnt)
{
	if (evnt.ctrlKey)
	{
		evnt.preventDefault();
		let slider = document.getElementById("ZoomSlider");
		let currentValue = JSON.parse(slider.value);	
		if (evnt.wheelDelta > 0) //scroll up
			currentValue += 1;
		else if (evnt.wheelDelta < 0) //scroll down
			currentValue -= 1;

		canvasControl.changeZoom(currentValue);
		canvasControl.refreshZoomSlider();
		canvasControl.refreshCanvas();
	}
});


//listener for update to the zoom slider
document.getElementById("ZoomSlider").addEventListener("input", function()
{
	let slider = document.getElementById("ZoomSlider");
	canvasControl.changeZoom(slider.value);
	canvasControl.refreshZoomSlider();
	canvasControl.refreshCanvas();
});


//returns 0 if update needed page update warranted, -1 if not
function canvasClickHelper_DrawMode(clickX, clickY)
{
	let p = patternControl.getActivePatternState();
	let layerIndex = p.getLastSelectedLayerIndex();
	if (layerIndex == -1)
	{
		if (p.layers.length > 0)
		{
			console.log("error: no layer selected in add mode");
			return -1;
		}
		p.layers.push(new Layer(null)); //create a layer to contain the new stitch
		layerIndex = 0;
	}
	
	//add new stitch and select it
	p = patternControl.pushPatternStateClone();
	let layer = p.layers[layerIndex];
	layer.stitches.push(new Stitch(clickX, clickY, false));
	p.deselectAll();
	p.selectLastStitchOfLayer(layerIndex);
	return 0;
}


//returns 0 if update needed page update warranted, -1 if not
function canvasClickHelper_SelectMode(clickX, clickY)
{
	let p = patternControl.getActivePatternState();
	let clickedStitchInfo = p.checkCoordinatesForIntersection(clickX, clickY);
	if (clickedStitchInfo !== null) //stitchpoint or stitchline
	{
		let layerIndex = clickedStitchInfo[2];
		let stitchIndex = clickedStitchInfo[1];

		//the current selection, if any, is not what is being clicked
		if (p.layers[layerIndex].stitches[stitchIndex].selected == false)
		{
			p.deselectAll();
			p.selectSingleStitch(layerIndex, stitchIndex);
			return 0;
		}
	}
	return -1;
}


//listener for button click on the main canvas;
//note: click happens after mouse down and mouse up
document.getElementById("MainCanvas").addEventListener("click", function(evnt)
{
	let coords = getCoordinatesOfMouseEvent(evnt);
	let clickResult;
	if (drawMode == true)
		clickResult = canvasClickHelper_DrawMode(coords.x, coords.y);
	else //select mode
	clickResult = canvasClickHelper_SelectMode(coords.x, coords.y);
	if (clickResult != -1)
		refreshWholePage();
});


//listener for mousedown on the main canvas
//note: mousedown happens immediately after the down click
document.getElementById("MainCanvas").addEventListener("mousedown", function(evnt)
{
	let coords = getCoordinatesOfMouseEvent(evnt);
	if (drawMode == false) //in select mode
	{
		let p = patternControl.getActivePatternState();
		let mouseLocationInfo = p.checkCoordinatesForIntersection(coords.x, coords.y);
		if (mouseLocationInfo !== null) //StitchPoint or StitchLine
		{
			let layerIndex = mouseLocationInfo[2];
			let stitchIndex = mouseLocationInfo[1];

			//the current selection, if any, is not what is being clicked
			if (p.layers[layerIndex].stitches[stitchIndex].selected == false)
			{
				p.deselectAll();
				p.selectSingleStitch(layerIndex, stitchIndex);
			}
			canvasControl.moveLastHeld(coords.x, coords.y);
			document.body.style.cursor = "grabbing";
			refreshWholePage();
		}
		else //empty canvas space
			canvasControl.openSelectionSquare(coords.x, coords.y)
	}
});


//listener for mousemove on the main canvas
document.getElementById("MainCanvas").addEventListener("mousemove", function(evnt)
{
	if (drawMode == false) //in select mode
	{
		let coords = getCoordinatesOfMouseEvent(evnt);
		let p = patternControl.getActivePatternState();
		if (canvasControl.holdingStitches() == true)
		{
			//get change in x and change in y relative to last held location and move accordingly
			let movement = canvasControl.moveLastHeld(coords.x, coords.y);
			p.moveAllSelected(movement.x, movement.y);
			canvasControl.refreshCanvas();	
		}
		else if (canvasControl.drawingSelectionSquare() == true)
		{
			canvasControl.resizeSelectionSquare(coords.x, coords.y);
			canvasControl.refreshCanvas();	
		}
		else //holding/moving/resizing nothing
		{
			let mouseLocationInfo = p.checkCoordinatesForIntersection(coords.x, coords.y);
			if (mouseLocationInfo === null)
				document.body.style.cursor = "auto";
			else //stitch point or stitch line
				document.body.style.cursor = "grab";
		}
	}
	else
		document.body.style.cursor = "crosshair";
});


//listener for mouseup on the main canvas
document.getElementById("MainCanvas").addEventListener("mouseup", function()
{
	if (drawMode == true)
		return;
	if (canvasControl.holdingStitches() == true)
	{
		canvasControl.releaseLastHeld();
		document.body.style.cursor = "grab";
	}
	else if (canvasControl.drawingSelectionSquare() == true)
	{
		let square = canvasControl.closeSelectionSquare();
		let p = patternControl.getActivePatternState();
		p.reselectAllWithinBox(square.tlx, square.tly, square.brx, square.bry);
		refreshWholePage();
	}
});


//listen for delete button
document.onkeydown = function(evnt)
{
	if (evnt.key === "Delete")
		deleteSelectedOnPage();
};


//listener for delete stitch button
document.getElementById("DeleteStitchButton").addEventListener("click", function(evnt)
{
	deleteSelectedOnPage();
});


//listener for add layer button
document.getElementById("AddLayerButton").addEventListener("click", function(evnt)
{
	addLayerOnPage();
});


//listener for undo button
document.getElementById("UndoButton").addEventListener("click", function(evnt)
{
	patternControl.revertBack();
	refreshWholePage();
});


//listener for redo button
document.getElementById("RedoButton").addEventListener("click", function(evnt)
{
	patternControl.revertForward();
	refreshWholePage();	
});


//listener for rand color button
document.getElementById("RandColor").addEventListener("click", function(evnt)
{
	//adapted from https://www.freecodecamp.org/news/here-is-the-most-popular-ways-to-make-an-http-request-in-javascript-954ce8c95aaa/
	//and https://reqbin.com/code/javascript/wzp2hxwh/javascript-post-request-example
	let req = new XMLHttpRequest();
	req.open("POST", base_server_url + server_port_num + "/rand_rgb");
	req.setRequestHeader("Accept", "application/json");
	req.setRequestHeader("Content-Type", "application/json");

	req.onreadystatechange = function() //callback on receipt of response from the server
	{
		if (req.readyState !== 4)
			return;

		let responseObj = JSON.parse(req.responseText);
		let p = patternControl.pushPatternStateClone(); //save previous state/return clone
		for (let i = 0; i < p.layers.length; ++i)
		{
			let currentLayer = p.layers[i];
			let responseLayer = responseObj.data[i];
			currentLayer.r = responseLayer.r;
			currentLayer.g = responseLayer.g;
			currentLayer.b = responseLayer.b;
		}
		refreshWholePage();
	};

	//package all the layer colors into a request object and then send it (via POST)
	let requestObj = {status:"run", data:[]};
	let ptrn = patternControl.getActivePatternState();
	for (let j = 0; j < ptrn.layers.length; ++j)
	{
		let layer = ptrn.layers[j];
		requestObj.data.push({r:layer.r, g:layer.g, b:layer.b});
	}
	req.send(JSON.stringify(requestObj));
});


//listener for button click to save to .exp file
//adapted from https://stackoverflow.com/questions/21012580/is-it-possible-to-write-data-to-file-using-only-javascript
document.getElementById("SaveEXPButton").addEventListener("click", function(evnt)
{
	//to avoid memory leaks, any previously generated url should be destroyed
	if (saveFile != null)
		window.URL.revokeObjectURL(saveFile);

	let p = patternControl.getActivePatternState();
	let expFileData = p.convertToEXP(50);
	alert("results of patternToEXP call:\n" + JSON.stringify(expFileData));

	let dataBlob = new Blob([expFileData], {type: 'text/plain'});
	saveFile = window.URL.createObjectURL(dataBlob); //save url to global variable for use as href

	let downloadLink = document.getElementById("SaveEXPLink");
	downloadLink.href = saveFile;
	let event = new MouseEvent('click');
	downloadLink.dispatchEvent(event); //this link is hidden in the html file
});


//***EXECUTABLE CODE***


refreshWholePage(); //just to initialize drawing everything correctly to start