//***GLOBALS***

const base_server_url = "http://localhost:";
const server_port_num = 3000;

let maxHxLength = 5;
let patternStateHx = [];
patternStateHx.push(new Pattern());
let patternIndex = 0;
let p = patternStateHx[patternIndex];

let zc = new ZoomControl();

let drawMode = true; //boolean
let showStitchInfo = false; //boolean

let selected = [];
selectSingleLayer(0); //assumed that the pattern is starting with at least one layer

let lastHeldX = -1;
let lastHeldY = -1;

let showWarnings = true; //boolean

let pointRadius = 8;
let lineDetectTolerance = 3;

let selectionSquare = //stores info about any selection square drawn by user
{
	exists:false,
	origin: {x: -1, y: -1},
	topLeft: {x: -1, y: -1},
	bottomRight: {x: -1, y: -1}
};


//***FUNCTION DEFINITIONS***

function ZoomControl()
{
	this.h = 1000; //matches the element height in pixels set in index.html
	this.w = 1500; //matches the element width in pixels set in index.html
	this.scaleFactor = 1;
	return this;
}


ZoomControl.prototype.zoomIn = function()
{
	if (this.scaleFactor < 2)
	{
		this.h += 100;
		this.w += 150;
		this.scaleFactor += 0.1;
		return true;
	}
	return false;
};


ZoomControl.prototype.zoomOut = function()
{
	if (this.scaleFactor > 1)
	{
		this.h -= 100;
		this.w -= 150;
		this.scaleFactor -= 0.1;
		return true;
	}
	return false;
};


function SelectedLayer(layerIndex, stitchIndices)
{
	this.layerIndex = layerIndex;
	this.stitchIndices = [];
	for (let i = 0; i < stitchIndices.length; ++i)
		this.stitchIndices.push(stitchIndices[i]);
}


function Stitch(x, y, selected)
{
	this.x = x;
	this.y = y;
	this.selected = selected;
	return this;	
};


function Layer(layerToCopy)
{
	this.stitches = [];
	if (layerToCopy === null)
	{
		this.r = 50;
		this.g = 90;
		this.b = 60;
	}
	else
	{
		for(i = 0; i < layerToCopy.stitches.length; ++i)
			this.stitches.push(new Stitch(layerToCopy.stitches[i].x, layerToCopy.stitches[i].y, layerToCopy.stitches[i].selected));
		this.r = layerToCopy.r;
		this.g = layerToCopy.g;
		this.b = layerToCopy.b;	
	}
	return this;	
}

function Pattern()
{
	this.layers = [];
	this.layers.push(new Layer(null));
	return this;
};


Pattern.prototype.pDeepCopy = function(otherPattern)
{
	while (this.layers.length > 0)
		this.layers.pop();
	for	(let i = 0; i < otherPattern.layers.length; ++i)
		this.layers.push(new Layer(otherPattern.layers[i]));
}


function deselectAll()
{
	while (selected.length > 0)
		selected.pop();

	//I'm doing a full sweep instead of targeting based on selected,
	//because I don't know if the pattern has been modified (e.g. some stitches have been deleted)
	//and selected could be out of date
	for (let i = 0; i < p.layers.length; ++i)
	{
		let currentLayer = p.layers[i];
		for (let j = 0; j < p.layers[i].stitches.length; ++j)
			currentLayer.stitches[j].selected = false;
	}
}


//ensures layerIndex is represented in selected
//assumes layerIndex is in range
//maintains ordering of layerIndices
//returns the index of selected which represents the selected layer
function selectSingleLayer(layerIndex)
{
	for (let i = 0; i < selected.length; ++i)
	{
		if (layerIndex < selected[i].layerIndex)
		{
			selected.splice(i, 0, new SelectedLayer(layerIndex, []));
			return i;
		}
		else if (layerIndex == selected[i].layerIndex)
			return i;
	}
	selected.push(new SelectedLayer(layerIndex, []));
	return selected.length - 1;
}

//assumes both layerIndex and stitchIndex are in range
//marks the stitch as selected if not already so
function selectSingleStitch(layerIndex, stitchIndex)
{
	p.layers[layerIndex].stitches[stitchIndex].selected = true;
	let i = selectSingleLayer(layerIndex); //ensure the layer is selected
	for (let j = 0; j < selected[i].stitchIndices.length; ++j)
	{
		if (stitchIndex < selected[i].stitchIndices[j])
		{
			selected[i].stitchIndices.splice(j, 0, stitchIndex);
			return;
		}
		else if (stitchIndex == selected[i].stitchIndices[j])
			return; //stitch already selected
	}
	selected[i].stitchIndices.push(stitchIndex);
}


//selects the last stitch of the layer if the layer contains any stitches,
//otherwise just ensures that the layer is selected
//assumes layerIndex is in range
function selectLastStitchOfLayer(layerIndex)
{
	let stitchIndex = p.layers[layerIndex].stitches.length - 1;
	if (stitchIndex >= 0)
		selectSingleStitch(layerIndex, stitchIndex);
	else
		selectSingleLayer(layerIndex);
}


function clearCanvas(canvasElement)
{
	let context = canvasElement.getContext('2d');
	context.clearRect(0, 0, canvasElement.width, canvasElement.height); //copied from https://stackoverflow.com/questions/2142535/how-to-clear-the-canvas-for-redrawing
};


function drawStitchPoint(canvasElement, xCoord, yCoord, selected, r, g, b)
{
	let context = canvasElement.getContext('2d');
	let drawX = xCoord * zc.scaleFactor;
	let drawY = yCoord * zc.scaleFactor;

	context.beginPath();
	context.moveTo(drawX, drawY);
	if (selected == true)
		context.lineWidth = 4;
	else //selected == false
		context.lineWidth = 1;	
	context.arc(drawX, drawY, pointRadius, 0, 2 * Math.PI); //start point circle
	context.strokeStyle = "rgb(" + r + ", " + g + ", " + b + ")";
	context.stroke();
};


function drawStitchLine(canvasElement, x1, y1, x2, y2, selected, r, g, b)
{
	let context = canvasElement.getContext('2d');
	let drawX1 = x1 * zc.scaleFactor;
	let drawY1 = y1 * zc.scaleFactor;
	let drawX2 = x2 * zc.scaleFactor;
	let drawY2 = y2 * zc.scaleFactor;

	context.beginPath();
	context.moveTo(drawX1, drawY1);
	if (selected == true)
		context.lineWidth = 4;
	else //selected == false
		context.lineWidth = 1;
	context.lineTo(drawX2, drawY2); //stitch line
	context.strokeStyle = "rgb(" + r + ", " + g + ", " + b + ")";	
	context.stroke();
};


function drawPatternToCanvas(canvasElement, pattern)
{
	clearCanvas(canvasElement);

	for (let j = 0; j < pattern.layers.length; ++j)
	{
		let currentLayer = pattern.layers[j];
		if (currentLayer.stitches.length == 0)
			continue;
		let sp1 = currentLayer.stitches[0];
		drawStitchPoint(canvasElement, sp1.x, sp1.y, sp1.selected, currentLayer.r, currentLayer.g, currentLayer.b); //draw the first point
		for (let i = 1; i < currentLayer.stitches.length; ++i)
		{
			let sp2 = currentLayer.stitches[i];
			drawStitchLine(canvasElement, sp1.x, sp1.y, sp2.x, sp2.y, sp2.selected, currentLayer.r, currentLayer.g, currentLayer.b); //draw stitch line
			drawStitchPoint(canvasElement, sp2.x, sp2.y, sp2.selected, currentLayer.r, currentLayer.g, currentLayer.b); //draw next stitch point
			sp1 = sp2;
		}
	}
}


function drawSelectionSquare(canvasElement)
{
	if (selectionSquare.exists == false)
		return;
	
	let x = selectionSquare.topLeft.x * zc.scaleFactor;
	let y = selectionSquare.topLeft.y * zc.scaleFactor;	
	let width = (selectionSquare.bottomRight.x * zc.scaleFactor) - x;
	let height = (selectionSquare.bottomRight.y * zc.scaleFactor) - y;

	let context = canvasElement.getContext('2d');
	context.beginPath();
	context.setLineDash([5, 15]);
	context.lineWidth = 1;
	context.strokeStyle = "rgb(0, 0, 0)"; //black
	context.rect(x, y, width, height);
	context.stroke()
}


function populateLayerTable()
{
	let layerTable = document.getElementById("LayerTable");
	let row = layerTable.lastElementChild; 
	while (row) //remove all rows currently in the layer table
	{
		layerTable.removeChild(row);
		row = layerTable.lastElementChild;
	}

	let j = 0;
	for (let i = 0; i < p.layers.length; ++i) //populate all elements in the layer table
	{
		//identify whether this layer is selected
		let layerSelected = false;
		if (j < selected.length && selected[j].layerIndex == i)
		{
			layerSelected = true;
			++j;
		}

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
		if (layerSelected)
		{
			row.style.border = "solid";
			
			col = document.createElement("td");
			row.appendChild(col);
			let colorPicker = document.createElement("input");
			colorPicker.type = "color";
			colorPicker.style.cursor = "pointer";
			col.appendChild(colorPicker);

			let lyer = p.layers[i];
			let strR = lyer.r.toString(16);
			if (strR.length < 2)
				strR = "0" + strR; 
			let strG = lyer.g.toString(16);
			if (strG.length < 2)
				strG = "0" + strG; 
			let strB = lyer.b.toString(16);
			if (strB.length < 2)
				strB = "0" + strB; 
			colorPicker.value = "#" + strR + "" + strG + "" + strB; //this should convert to a hex string format e.g. #001122

			colorPicker.addEventListener("change", function(evnt)
			{	
				layerColorPickerChangeListener(evnt);
			});
		}
	}
}


function updateStitchInfoDisplay()
{
	if (showStitchInfo == true)
	{
		if (selected.length == 0)
		{
			document.getElementById("StitchLayerIndexCell").innerHTML = "(no layer(s) selected)";
			document.getElementById("StitchIndexCell").innerHTML = "(no layer(s) selected)";
			document.getElementById("StitchXCoordCell").innerHTML = "(no layer(s) selected)";
			document.getElementById("StitchYCoordCell").innerHTML = "(no layer(s) selected)";
			document.getElementById("StitchColorCell").innerHTML = "(no layer(s) selected)";			
		}
		else if (selected.length > 1)
		{
			document.getElementById("StitchLayerIndexCell").innerHTML = "(multiple layers selected)";
			document.getElementById("StitchIndexCell").innerHTML = "(multiple layers selected)";
			document.getElementById("StitchXCoordCell").innerHTML = "(multiple layers selected)";
			document.getElementById("StitchYCoordCell").innerHTML = "(multiple layers selected)";
			document.getElementById("StitchColorCell").innerHTML = "(multiple layers selected)";	
		}
		else //selected.length == 1
		{
			if (selected[0].stitchIndices.length > 1)
			{
				document.getElementById("StitchLayerIndexCell").innerHTML = "(multiple stitches selected)";
				document.getElementById("StitchIndexCell").innerHTML = "(multiple stitches selected)";
				document.getElementById("StitchXCoordCell").innerHTML = "(multiple stitches selected)";
				document.getElementById("StitchYCoordCell").innerHTML = "(multiple stitches selected)";
				document.getElementById("StitchColorCell").innerHTML = "(multiple stitches selected)";					
			}
			else if (selected[0].stitchIndices.length == 0)
			{
				document.getElementById("StitchLayerIndexCell").innerHTML = "(no stitch(es) selected)";
				document.getElementById("StitchIndexCell").innerHTML = "(no stitch(es) selected)";
				document.getElementById("StitchXCoordCell").innerHTML = "(no stitch(es) selected)";
				document.getElementById("StitchYCoordCell").innerHTML = "(no stitch(es) selected)";
				document.getElementById("StitchColorCell").innerHTML = "(no stitch(es) selected)";
			}
			else //(selected[0].stitchIndices.length == 1)
			{
				document.getElementById("StitchLayerIndexCell").innerHTML = selected[0].layerIndex;
				document.getElementById("StitchIndexCell").innerHTML = selected[0].stitchIndices[0];
				document.getElementById("StitchXCoordCell").innerHTML = p.layers[selected[0].layerIndex].stitches[selected[0].stitchIndices[0]].x;
				document.getElementById("StitchYCoordCell").innerHTML = p.layers[selected[0].layerIndex].stitches[selected[0].stitchIndices[0]].y;
				document.getElementById("StitchColorCell").innerHTML = "rgb(" + p.layers[selected[0].layerIndex].r + ", " + p.layers[selected[0].layerIndex].g + ", " + p.layers[selected[0].layerIndex].b + ")";
			}
		}
		document.getElementById("StitchInfoTable").hidden = false;
	}
	else
		document.getElementById("StitchInfoTable").hidden = true;
}


function updatePage()
{	
	//set zoom slider value
	let slider = document.getElementById("ZoomSlider");
	slider.value = (zc.scaleFactor * 10) - 10;

	//update the mode switch
	let modeSwitch = document.getElementById("ModeSwitch");
	if (drawMode == true)
		modeSwitch.checked = true;
	else
		modeSwitch.checked = false;

	//set canvas dimensions
	let c = document.getElementById("MainCanvas");
	c.height = zc.h;
	c.width = zc.w;

	//draw the pattern
	drawPatternToCanvas(c, p);

	//draw any selection square generated by the user
	drawSelectionSquare(c);

	//update the stitch info switch
	let stitchInfoSwitch = document.getElementById("StitchInfoSwitch");
	stitchInfoSwitch.checked = showStitchInfo;

	//update layer/stitch info in the layer table
	populateLayerTable();

	//show or hide info about selected stitch
	updateStitchInfoDisplay();

	//enable/disable undo and redo buttons
	document.getElementById("UndoButton").disabled = !canRevertBack();
	document.getElementById("RedoButton").disabled = !canRevertForward();
}


//returns three ints in a list: the first is 0 or an StitchPoint, 1 for a StitchLine
//the second corresponds to the index of the StitchPoint (0 through n - 1) or StitchLine (1 through n - 1)
//and the third corresponds to the index of the layer of the StitchPoint or StitchLine
//the full return is null if mouseX and mouseY correspond to empty space in the canvas
//used to determine whether the mouseX and mouseY are over a StitchPoint, StitchLine,
//or an empty part of the canvas
function determineCursorLocation(mouseX, mouseY)
{
	let result = cursorOnStitchPoint(mouseX, mouseY);
	if (result !== null)
		result.unshift(0); //signal StitchPoint found
	else
	{
		result = cursorOnStitchLine(mouseX, mouseY);
		if (result !== null)
			result.unshift(1); //signal StitchLine found
	}
	return result;
}


//helper to determineCursorLocation
//returns list of [a, b], where a the StitchPoint index and b is the Layer index
//of the StitchPoint over which the cursor is located
//returns null if the cursor is not located over a StitchPoint
function cursorOnStitchPoint(mouseX, mouseY)
{
	let returnVals = [];
	for (let j = 0; j < p.layers.length; ++j)
	{
		let currentLayer = p.layers[j];
		for (let i = 0; i < currentLayer.stitches.length; ++i)
		{
			//find whether the mouse intersects the current StitchPoint
			let currentX = currentLayer.stitches[i].x;
			let currentY = currentLayer.stitches[i].y;
			let diffX = Math.abs(currentX - mouseX);
			let diffY = Math.abs(currentY - mouseY);
			let dist = Math.sqrt((diffX * diffX) + (diffY * diffY)); //a^2 + b^2 = c^2
			if (dist <= pointRadius)
			{
				returnVals.push(i); //StitchPoint index
				returnVals.push(j); //layer index
				return returnVals;
			}
		}
	}
	return null; //mouse not near any StitchPoint or StitchLine
}


//helper to determineCursorLocation
//returns list of [a, b], where a the StitchLine index (1 through n - 1) and b is the Layer index
//of the StitchLine over which the cursor is located
//returns null if the cursor is not located over a StitchPoint
function cursorOnStitchLine(mouseX, mouseY)
{
	let returnVals = [];
	for (let j = 0; j < p.layers.length; ++j)
	{
		let currentLayer = p.layers[j];

		if (currentLayer.stitches.length == 0)
			continue;
		let x2 = currentLayer.stitches[0].x;
		let y2 = currentLayer.stitches[0].y;
		for (let i = 1; i < currentLayer.stitches.length; ++i)
		{
			let x1 = x2;
			let y1 = y2;
			x2 = currentLayer.stitches[i].x;
			y2 = currentLayer.stitches[i].y;

			let diffX = Math.abs(x2 - x1);
			let diffY = Math.abs(y2 - y1);
			let dist1 = Math.sqrt((diffX * diffX) + (diffY * diffY)); //a^2 + b^2 = c^2 (is distance from stitches[i - 1] to stitches[i])
			diffX = Math.abs(x1 - mouseX);
			diffY = Math.abs(y1 - mouseY);
			let dist2 = Math.sqrt((diffX * diffX) + (diffY * diffY)); //a^2 + b^2 = c^2 (is distance from stitches[i - 1] to cursor)
			diffX = Math.abs(x2 - mouseX);
			diffY = Math.abs(y2 - mouseY);
			let dist3 = Math.sqrt((diffX * diffX) + (diffY * diffY)); //a^2 + b^2 = c^2 (is distance from stitches[i] to cursor)

			if (dist2 + dist3 < dist1 + lineDetectTolerance)
			{
				returnVals.push(i); //StitchLine pseudoIndex
				returnVals.push(j); //layer index
				return returnVals;
			}
		}
	}
	return null; //mouse not near any StitchPoint or StitchLine
}


function deleteSelectedInPattern()
{
	if (selected.length == 0) //no selection
		return;
	let i;
	if (showWarnings == true)
	{
		let deletingLayer = false;
		for (i = 0; i < selected.length; ++i)
		{
			let currentLayer = p.layers[selected[i].layerIndex];
			if (selected[i].stitchIndices.length == currentLayer.stitches.length)
			{
				deletingLayer = true;
				break;
			}
		}
		let warningMessage;
		if (deletingLayer == true)
			warningMessage = "You are about to delete every stitch in one or more layers. The entire layer(s) will be deleted, do you wish to proceed?";
		else //deletingLayer == false
		warningMessage = "You are about to delete the selected stitch(es). Do you wish to proceed?";
		if (confirm(warningMessage) == false)
			return;
	}

	let lastSelectedLayer = -1;
	if (drawMode == true)
		lastSelectedLayer = selected[selected.length - 1].layerIndex;

	saveToPatternChangeHx(); //save previous state of the pattern

	for (i = selected.length - 1; i >= 0; --i) //backward iteration because splicing could otherwise cause issues
	{
		let currentLayer = p.layers[selected[i].layerIndex];
		if (currentLayer.stitches.length == selected[i].stitchIndices.length) //every stitch in the layer is selected
			p.layers.splice(selected[i].layerIndex, 1);
		else //only some stitch(es) in the layer, but not all, are being deleted
		{
			for (let j = selected[i].stitchIndices.length - 1; j >= 0; --j) //backward iteration because splicing could otherwise cause issues
				currentLayer.stitches.splice(selected[i].stitchIndices[j], 1);	
		}	
	}
	
	deselectAll(); //empty selected
	if (lastSelectedLayer != -1) //in draw mode, find a new terminal selection if any is available
	{
		while (lastSelectedLayer >= p.layers.length)
			--lastSelectedLayer;
		if (lastSelectedLayer >= 0) //one or more layers left
			selectLastStitchOfLayer(lastSelectedLayer);
	}
	
	updatePage();

	if (showWarnings == true)
		showWarnings = confirm("Continue receiving warning messages?");
}


function addNewLayer()
{
	saveToPatternChangeHx();
	p.layers.push(new Layer(null));
	deselectAll();
	selectLastStitchOfLayer(p.layers.length - 1);
	updatePage();
}


function canRevertBack()
{
	return (patternIndex > 0);
}


function canRevertForward()
{
	return (patternIndex < patternStateHx.length - 1);
}


function saveToPatternChangeHx()
{
	if (canRevertForward() == true)
	{
		while (patternStateHx.length > patternIndex + 1)
			patternStateHx.pop();
	}

	patternStateHx.push(new Pattern());
	++patternIndex;
	patternStateHx[patternIndex].pDeepCopy(p);
	p = patternStateHx[patternIndex];

	if (patternStateHx.length > maxHxLength)
	{
		patternStateHx.splice(0, 1); //remove the oldest saved pattern state
		--patternIndex;
	}
}


function revertBack()
{
	if (canRevertBack() == false)
		return false;
	--patternIndex;
	p = patternStateHx[patternIndex];

	deselectAll();
	selectLastStitchOfLayer(p.layers.length - 1);
	updatePage();
	return true;
}


function revertForward()
{
	if (canRevertForward() == false)
		return false;
	++patternIndex;
	p = patternStateHx[patternIndex];

	deselectAll();
	selectLastStitchOfLayer(p.layers.length - 1);
	updatePage();
	return true;
}


//***EVENT LISTENERS***


//used as listener for dynamically added layer rows in the layer table
function layerTableClickListener(evnt)
{
	let rowIndex = 0;
	let currentRow = evnt.target.parentElement; //clicked element is <td>, parent expected to be <tr>
	while (currentRow.previousElementSibling)
	{
		currentRow = currentRow.previousElementSibling;
		++rowIndex;
	}			

	deselectAll();
	if (drawMode == true)
		selectLastStitchOfLayer(rowIndex); //select the last stitch in the layer
	else //drawMode == false
	{
		for (let i = p.layers[rowIndex].stitches.length - 1; i >= 0; --i) //select all the stitches in the layer
			selectSingleStitch(rowIndex, i);
	}
	updatePage();	
}


//used as listener for dynamically added layer color picker in the layer table
function layerColorPickerChangeListener(evnt)
{	
	//adapted from https://stackoverflow.com/questions/58184508/html5-input-type-color-read-single-rgb-values
	let colorInput = evnt.target;

	let rowIndex = 0;
	let currentRow = colorInput.parentElement.parentElement; //changed element is <input>, parent expected to be <td>, parent of parent expected to be <tr>
	while (currentRow.previousElementSibling)
	{
		currentRow = currentRow.previousElementSibling;
		++rowIndex;
	}	
	let layer = p.layers[rowIndex];
	
	let colorStr = colorInput.value;
	layer.r = parseInt(colorStr.substr(1,2), 16);
	layer.g = parseInt(colorStr.substr(3,2), 16);
	layer.b = parseInt(colorStr.substr(5,2), 16);
	updatePage();
}


//mode checkbox event listener
document.getElementById("ModeSwitch").addEventListener("change", function(evnt)
{
	let modeSwitch = document.getElementById("ModeSwitch");
	drawMode = modeSwitch.checked;
	if (drawMode == true)
	{
		let layerIndex = -1;
		if (selected.length > 0)
			layerIndex = selected[selected.length - 1].layerIndex; //last layer of those currently selected
		else if (p.layers.length > 0)
			layerIndex = p.layers.length - 1; //last layer in the pattern
		if (layerIndex != -1)
		{
			deselectAll();
			selectLastStitchOfLayer(layerIndex);
		}
	}
	updatePage();
});


//stitch info checkbox event listener
document.getElementById("StitchInfoSwitch").addEventListener("change", function(evnt)
{
	let showInfoSwitch = document.getElementById("StitchInfoSwitch");
	showStitchInfo = showInfoSwitch.checked;
	updatePage();
});


//listener for ctrl-mousewheel on the main canvas
document.getElementById("MainCanvas").addEventListener("wheel", function(evnt)
{
	let requireUpdate = false;
	if (evnt.ctrlKey)
	{
		evnt.preventDefault();
		if (evnt.wheelDelta > 0) //scroll up
			requireUpdate = zc.zoomIn();
		else //evnt.wheelDelta <= 0 //scroll down
			requireUpdate = zc.zoomOut();
	}
	if (requireUpdate != false)
		updatePage();
});


//listener for update to the zoom slider
document.getElementById("ZoomSlider").addEventListener("input", function(evnt) //change
{
	let slider = document.getElementById("ZoomSlider");
	let newScaleFactor = 1 + (slider.value / 10);
	if (newScaleFactor > zc.scaleFactor)
	{
		while (zc.scaleFactor < newScaleFactor)
		{
			if (zc.zoomIn() == false)
				break;
		}
		updatePage();	
	}
	else if (newScaleFactor < zc.scaleFactor)
	{
		while (zc.scaleFactor > newScaleFactor)
		{
			if (zc.zoomOut() == false)
				break;
		}
		updatePage();
	}	
});


//listener for button click on the main canvas;
//note: mousedown happens after the down click, mouse click happens after mouse down and mouse up over the same element?
document.getElementById("MainCanvas").addEventListener("click", function(evnt)
{
	//gets coordinates of the mouse event
	//adapted from https://stackoverflow.com/questions/55677/how-do-i-get-the-coordinates-of-a-mouse-click-on-a-canvas-element
	//and from https://stackoverflow.com/questions/17130395/real-mouse-position-in-canvas
	let c = document.getElementById("MainCanvas");
	let rectangle = c.getBoundingClientRect();
	let mouseX = ((evnt.clientX - rectangle.left) * c.width) / (rectangle.right - rectangle.left);
	let mouseY = ((evnt.clientY - rectangle.top) * c.height) / (rectangle.bottom - rectangle.top);

	if (drawMode == true)
	{
		if (selected.length > 1)
		{
			console.log("error: attempted to add stitch with multiple layers selected");
			return;
		}
		
		saveToPatternChangeHx();
		let layerIndex;
		if (selected.length == 0) //assuming this is because all layers have been deleted
		{
			p.layers.push(new Layer(null));
			layerIndex = 0;
		}
		else
			layerIndex = selected[0].layerIndex;
		p.layers[layerIndex].stitches.push(new Stitch(mouseX / zc.scaleFactor, mouseY / zc.scaleFactor, false));
		deselectAll();
		selectLastStitchOfLayer(layerIndex);
	}
	else
	{
		let returnVal = determineCursorLocation(mouseX, mouseY);
		if (returnVal === null)
			return;
		else //stitchpoint or stitchline
		{
			if (p.layers[returnVal[2]].stitches[returnVal[1]].selected == false) //the current selection, if any, is not what is being clicked
			{
				deselectAll();
				selectSingleStitch(returnVal[2], returnVal[1]); //select the clicked StitchPoint/StitchLine
			}
		}
	}
	updatePage();
});


//listener for mousedown on the main canvas
//note: mousedown happens after the down click, mouse click happens after mouse down and mouse up over the same element?
document.getElementById("MainCanvas").addEventListener("mousedown", function(evnt)
{
	//gets coordinates of the mouse event
	//adapted from https://stackoverflow.com/questions/55677/how-do-i-get-the-coordinates-of-a-mouse-click-on-a-canvas-element
	//and from https://stackoverflow.com/questions/17130395/real-mouse-position-in-canvas
	let c = document.getElementById("MainCanvas");
	let rectangle = c.getBoundingClientRect();
	let mouseX = ((evnt.clientX - rectangle.left) * c.width) / (rectangle.right - rectangle.left) / zc.scaleFactor;
	let mouseY = ((evnt.clientY - rectangle.top) * c.height) / (rectangle.bottom - rectangle.top) / zc.scaleFactor;

	if (drawMode == false)
	{
		let returnVal = determineCursorLocation(mouseX, mouseY);
		if (returnVal !== null) //StitchPoint or StitchLine
		{
			if (returnVal[0] == 0) //StitchPoint
			{
				saveToPatternChangeHx(); //save previous state of the pattern
				if (p.layers[returnVal[2]].stitches[returnVal[1]].selected == false) //the current selection, if any, is not what is being clicked
				{
					deselectAll();
					selectSingleStitch(returnVal[2], returnVal[1]);
				}
				lastHeldX = mouseX;
				lastHeldY = mouseY;
				document.body.style.cursor = "grabbing";
				updatePage();
			}
		}
		else if (returnVal === null) //empty canvas space
		{
			selectionSquare.exists = true;
			selectionSquare.origin.x = mouseX;
			selectionSquare.origin.y = mouseY;
			selectionSquare.topLeft.x = mouseX;
			selectionSquare.topLeft.y = mouseY;
			selectionSquare.bottomRight.x = mouseX;
			selectionSquare.bottomRight.y = mouseY;
		}
	}
});


//listener for mousemove on the main canvas (mousemove occurs when the mouse moves while remaining on the canvas???)
document.getElementById("MainCanvas").addEventListener("mousemove", function(evnt)
{
	//gets coordinates of the mouse event
	//adapted from https://stackoverflow.com/questions/55677/how-do-i-get-the-coordinates-of-a-mouse-click-on-a-canvas-element
	//and from https://stackoverflow.com/questions/17130395/real-mouse-position-in-canvas
	let c = document.getElementById("MainCanvas");
	let rectangle = c.getBoundingClientRect();
	let mouseX = ((evnt.clientX - rectangle.left) * c.width) / (rectangle.right - rectangle.left) / zc.scaleFactor;
	let mouseY = ((evnt.clientY - rectangle.top) * c.height) / (rectangle.bottom - rectangle.top) / zc.scaleFactor;

	if (drawMode == false)
	{
		//holding/moving stitch(es)
		if (lastHeldX != -1)
		{
			let changeX = mouseX - lastHeldX;
			let changeY = mouseY - lastHeldY;
			for (let i = 0; i < selected.length; ++i)
			{
				let currentLayer = p.layers[selected[i].layerIndex];
				for (let j = 0; j < selected[i].stitchIndices.length; ++j)
				{
					let currentStitch = currentLayer.stitches[selected[i].stitchIndices[j]];
					currentStitch.x += changeX;
					currentStitch.y += changeY;
				}
			}
			lastHeldX = mouseX;
			lastHeldY = mouseY;
			drawPatternToCanvas(c, p);
			return;		
		}
		
		//holding/resizing a selection box
		else if (selectionSquare.exists == true)
		{
			if (mouseX > selectionSquare.origin.x)
			{
				selectionSquare.topLeft.x = selectionSquare.origin.x;
				selectionSquare.bottomRight.x = mouseX;			
			}
			else // mouseX <= selectionSquare.topLeft.x
			{
				selectionSquare.topLeft.x = mouseX;
				selectionSquare.bottomRight.x = selectionSquare.origin.x;
			}
			if (mouseY > selectionSquare.origin.y)
			{
				selectionSquare.topLeft.y = selectionSquare.origin.y;
				selectionSquare.bottomRight.y = mouseY;
			}
			else
			{
				selectionSquare.topLeft.y = mouseY;
				selectionSquare.bottomRight.y = selectionSquare.origin.y;
			}	
			updatePage();
			return;		
		}

		//holding/moving/resizing nothing
		let returnVal = determineCursorLocation(mouseX, mouseY);
		if (returnVal === null)
			document.body.style.cursor = "auto";
		else if (returnVal[0] == 0) //StitchPoint
			document.body.style.cursor = "grab";
		else //(returnVal[0] == 1) //StitchLine
			document.body.style.cursor = "help";
	}
	else
		document.body.style.cursor = "crosshair";
});


//listener for mouseup on the main canvas
document.getElementById("MainCanvas").addEventListener("mouseup", function(evnt)
{
	if (drawMode == true)
		return;

	if (lastHeldX != -1) //holding/moving a StitchPoint
	{
		lastHeldX = -1;
		lastHeldY = -1;
		document.body.style.cursor = "grab";
	}
	else if (selectionSquare.exists == true)
	{
		deselectAll();
		for (let i = 0; i < p.layers.length; ++i)
		{
			let currentLayer = p.layers[i];
			for (let j = 0; j < currentLayer.stitches.length; ++j)
			{
				let s = currentLayer.stitches[j];
				if (s.x >= selectionSquare.topLeft.x && s.x <= selectionSquare.bottomRight.x && s.y >= selectionSquare.topLeft.y && s.y <= selectionSquare.bottomRight.y)
					selectSingleStitch(i, j);
			}
		}
		selectionSquare.exists = false;
		updatePage();
	}
});


//listen for delete button
document.onkeydown = function(evnt)
{
	if (evnt.key === "Delete")
		deleteSelectedInPattern();
};


//listener for delete stitch button
document.getElementById("DeleteStitchButton").addEventListener("click", function(evnt)
{
	deleteSelectedInPattern();
});

//listener for add layer button
document.getElementById("AddLayerButton").addEventListener("click", function(evnt)
{
	addNewLayer();
});

//listener for undo button
document.getElementById("UndoButton").addEventListener("click", function(evnt)
{
	revertBack();
});


//listener for redo button
document.getElementById("RedoButton").addEventListener("click", function(evnt)
{
	revertForward();	
});

//listener for rand color button
document.getElementById("RandColor").addEventListener("click", function(evnt)
{
	//adapted from code retrieved from https://www.freecodecamp.org/news/here-is-the-most-popular-ways-to-make-an-http-request-in-javascript-954ce8c95aaa/
	//and https://reqbin.com/code/javascript/wzp2hxwh/javascript-post-request-example
	let req = new XMLHttpRequest();
	req.open("POST", base_server_url + server_port_num + "/rand_rgb");
	req.setRequestHeader("Accept", "application/json");
	req.setRequestHeader("Content-Type", "application/json");

	req.onreadystatechange = function () //callback function on receipt of response from the server
	{
		if (req.readyState === 4)
		{
			let responseObj = JSON.parse(req.responseText);

			//alert("req status: " + console.log(req.status) + ", response text: " + req.responseText); //testing

			//maybe do some validation here before saving

			saveToPatternChangeHx(); //save previous state of the pattern

			for (let j = 0; j < p.layers.length; ++j)
			{
				let currentLayer = p.layers[j];
				let responseLayer = responseObj.data[j];
				currentLayer.r = responseLayer.r;
				currentLayer.g = responseLayer.g;
				currentLayer.b = responseLayer.b;
			}
			updatePage();
		}
	};

	//package all the layer colors into a request object and then send it (via POST)
	let requestObj = {status:"run", data:[]};
	for (let i = 0; i < p.layers.length; ++i)
	{
		let currentLayer = p.layers[i];
		requestObj.data.push({r:currentLayer.r, g:currentLayer.g, b:currentLayer.b});
	}
	req.send(JSON.stringify(requestObj));
});


//***EXECUTABLE CODE***


updatePage(); //just to initialize drawing everything correctly to start

/*
//testing
let testArr = new Int8Array(16);
for (let i = 0; i < 16; ++i)
	testArr[i] = i;

//copied/adapted from https://stackoverflow.com/questions/21012580/is-it-possible-to-write-data-to-file-using-only-javascript
let textFile = null;
let textContent = "this is a test";
let makeTextFile = function(textContent)
{
	var dataBlob = new Blob([textContent], {type: 'text/plain'});

	// If we are replacing a previously generated file we need to
	// manually revoke the object URL to avoid memory leaks.
	if (textFile !== null)
		window.URL.revokeObjectURL(textFile);

	textFile = window.URL.createObjectURL(dataBlob);

	// returns a URL you can use as a href
	return textFile;
};
*/

//the stuff below is also copied from the same web page and I need to rework it
/*
var create = document.getElementById('create'),
textbox = document.getElementById('textbox');

create.addEventListener('click', function ()
{

	var link = document.createElement('a');
	link.setAttribute('download', 'info.txt');
	link.href = makeTextFile(textbox.value);
	document.body.appendChild(link);

	// wait for the link to be added to the document
	window.requestAnimationFrame(function ()
	{
		var event = new MouseEvent('click');
		link.dispatchEvent(event);
		document.body.removeChild(link);
	});

}, false);
*/

//testing