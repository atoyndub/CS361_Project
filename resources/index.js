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

let focusedLayer = 0; //index number
let focusedStitchPoint = 0; //index number
let stitchPointHeld = false; //boolean

let showWarnings = true; //boolean

let pointRadius = 8;
let lineDetectTolerance = 3;

let selectionSquare = {exists:false, topLeft:{x:-1,y:-1}, bottomRight:{x:-1,y:-1}}; //stores info about any selection square drawn by user

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


function Stitch(x, y)
{
	this.x = x;
	this.y = y;
	return this;	
};


function Layer(layerToCopy)
{
	this.stitches = [];
	if (layerToCopy === null)
	{
		this.stitches.push(new Stitch(750, 500));
		this.r = 50;
		this.g = 90;
		this.b = 60;
	}
	else
	{
		for(i = 0; i < layerToCopy.stitches.length; ++i)
			this.stitches.push(new Stitch(layerToCopy.stitches[i].x, layerToCopy.stitches[i].y));
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

	for(let j = 0; j < pattern.layers.length; ++j)
	{
		let currentLayer = pattern.layers[j];
		let sp1 = currentLayer.stitches[0];
		drawStitchPoint(canvasElement, sp1.x, sp1.y, focusedLayer == j && focusedStitchPoint == 0, currentLayer.r, currentLayer.g, currentLayer.b); //draw the first point
		
		for (let i = 1; i < currentLayer.stitches.length; ++i)
		{
			let sp2 = currentLayer.stitches[i];
			drawStitchLine(canvasElement, sp1.x, sp1.y, sp2.x, sp2.y, focusedLayer == j && focusedStitchPoint == i, currentLayer.r, currentLayer.g, currentLayer.b); //draw stitch line
			drawStitchPoint(canvasElement, sp2.x, sp2.y, focusedLayer == j && focusedStitchPoint == i, currentLayer.r, currentLayer.g, currentLayer.b); //draw next stitch point
			sp1 = sp2;
		}
	}
}


function drawSelectionSquare(canvasElement)
{
	if (selectionSquare.exists == false)
		return;
	let maxSegLength = 500;
	let horizontal = selectionSquare.bottomRight.x - selectionSquare.topLeft.x;
	let vertical = selectionSquare.topLeft.y - selectionSquare.bottomRight.y;
	if (horizontal < maxSegLength)
	{
		if (vertical < maxSegLength)
		{
			drawSelectionSquareSegment(canvasElement, selectionSquare.topLeft.x, selectionSquare.topLeft.y, horizontal, 0); //top horizontal
			drawSelectionSquareSegment(canvasElement, selectionSquare.topLeft.x, selectionSquare.bottomRight.y, horizontal, 0); //bottom horizontal
			drawSelectionSquareSegment(canvasElement, selectionSquare.topLeft.x, selectionSquare.bottomRight.y, vertical, 0); //left vertical
			drawSelectionSquareSegment(canvasElement, selectionSquare.bottomRight.x, selectionSquare.bottomRight.y, vertical, 0); //right vertical
		}
	}
}


function drawSelectionSquareSegment(canvasElement, x1, y1, segLength, direction)
{
	let context = canvasElement.getContext('2d');
	x1 *= zc.scaleFactor;
	y1 *= zc.scaleFactor;
	let x2;
	let y2;
	if (direction == 0) //horizontal line
	{
		x2 = (x1 + segLength) * zc.scaleFactor;
		y2 = y1;
	}
	else //direction == 1 //vertical line
	{
		x2 = x1;
		y2 = (y1 + segLength) * zc.scaleFactor;
	}

	context.beginPath();
	context.moveTo(x1, y1);
	context.lineWidth = 1;
	context.lineTo(x2, y2); //stitch line
	context.strokeStyle = "rgb(0, 0, 0)"; //black	
	context.stroke();
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
	for (let i = 0; i < p.layers.length; ++i) //populate all elements in the layer table
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

		//display a color picker for the focused layer
		if (i == focusedLayer)
		{
			row.style.border = "solid";
			
			col = document.createElement("td");
			row.appendChild(col);
			let colorPicker = document.createElement("input");
			colorPicker.type = "color";
			colorPicker.style.cursor = "pointer";
			col.appendChild(colorPicker);

			let lyer = p.layers[focusedLayer];
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
		document.getElementById("StitchLayerIndexCell").innerHTML = focusedLayer;
		document.getElementById("StitchIndexCell").innerHTML = focusedStitchPoint;
		document.getElementById("StitchXCoordCell").innerHTML = p.layers[focusedLayer].stitches[focusedStitchPoint].x;
		document.getElementById("StitchYCoordCell").innerHTML = p.layers[focusedLayer].stitches[focusedStitchPoint].y;
		document.getElementById("StitchColorCell").innerHTML = "rgb(" + p.layers[focusedLayer].r + ", " + p.layers[focusedLayer].g + ", " + p.layers[focusedLayer].b + ")";
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
		let x2 = currentLayer.stitches[0].x; //assumes each layer contains at least one StitchPoint
		let y2 = currentLayer.stitches[0].y; //assumes each layer contains at least one StitchPoint
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


function deleteSelectedStitch()
{
	//NOTE: I PURPOSEFULLY DO NOT SHORTEN p.layers[focusedLayer] ANYWHERE HERE BECAUSE saveToPatternChangeHx() CHANGES P
	//THIS SHOULD EVENTUALLY BE REFACTORED SO THAT saveToPatternChangeHx() CAN'T CAUSE HIDDEN ISSUES LIKE THIS
	if (p.layers[focusedLayer].stitches.length == 1)
	{
		if (showWarnings == true)
			showWarnings = confirm("You cannot delete the only stitch point in a pattern layer. Try deleting the pattern instead.\n\nContinue receiving warning messages?");
	}
	else
	{
		if (showWarnings == true && confirm("You are about to delete the selected stitch. Do you wish to proceed?") == false)
			return;

		saveToPatternChangeHx(); //save previous state of the pattern
		p.layers[focusedLayer].stitches.splice(focusedStitchPoint, 1); //removed the focused stitch point
		if (focusedStitchPoint == p.layers[focusedLayer].stitches.length)
			--focusedStitchPoint;
		updatePage();

		if (showWarnings == true)
			showWarnings = confirm("Continue receiving warning messages?");
	}
}


function addNewLayer()
{
	saveToPatternChangeHx();
	p.layers.push(new Layer(null));
	focusedLayer = p.layers.length - 1;
	focusedStitchPoint = p.layers[focusedLayer].stitches.length - 1;
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

	focusedLayer = p.layers.length - 1;
	focusedStitchPoint = p.layers[focusedLayer].stitches.length - 1;
	
	updatePage();
	return true;
}


function revertForward()
{
	if (canRevertForward() == false)
		return false;
	++patternIndex;
	p = patternStateHx[patternIndex];

	focusedLayer = p.layers.length - 1;
	focusedStitchPoint = p.layers[focusedLayer].stitches.length - 1;
	
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
	if (rowIndex != focusedLayer)
	{
		focusedLayer = rowIndex;
		focusedStitchPoint = p.layers[focusedLayer].stitches.length - 1;
		updatePage();
	}	
}


//used as listener for dynamically added layer color picker in the layer table
function layerColorPickerChangeListener(evnt)
{	
	//adapted from https://stackoverflow.com/questions/58184508/html5-input-type-color-read-single-rgb-values
	let colorInput = evnt.target;
	let layer = p.layers[focusedLayer];
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
		focusedStitchPoint = p.layers[focusedLayer].stitches.length - 1;
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
		saveToPatternChangeHx(); //save previous state of the pattern
		p.layers[focusedLayer].stitches.push(new Stitch(mouseX / zc.scaleFactor, mouseY / zc.scaleFactor));
		focusedStitchPoint = p.layers[focusedLayer].stitches.length - 1;
	}
	else
	{
		let returnVal = determineCursorLocation(mouseX, mouseY);
		if (returnVal === null)
			return;
		else //stitchpoint or stitchline
		{
			focusedLayer = returnVal[2];
			focusedStitchPoint = returnVal[1];
		}
	}
	updatePage();
});


//listener for mousedown on the main canvas
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
				focusedLayer = returnVal[2];
				focusedStitchPoint = returnVal[1];
				stitchPointHeld = true;
				document.body.style.cursor = "grabbing";
				updatePage();
			}
		}
		else if (returnVal === null) //empty canvas space
		{
			selectionSquare.exists = true;
			selectionSquare.topLeft.x = mouseX;
			selectionSquare.topLeft.y = mouseY;
			selectionSquare.bottomRight.x = mouseX;
			selectionSquare.bottomRight.y = mouseY;
			//NOT UPDATING AT THIS POINT BUT MAY DO SO LATER 
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
		//holding/moving a StitchPoint
		if (stitchPointHeld == true)
		{
			p.layers[focusedLayer].stitches[focusedStitchPoint].x = mouseX;
			p.layers[focusedLayer].stitches[focusedStitchPoint].y = mouseY;
			drawPatternToCanvas(c, p);
			return;		
		}
		
		//holding/resizing a selection box
		else if (selectionSquare.exists == true)
		{
			if (mouseX > selectionSquare.topLeft.x)
			{
				if (mouseY > selectionSquare.bottomRight.y) //mouse is below and to the right of selectionSquare.topLeft
				{
					selectionSquare.bottomRight.x = mouseX;
					selectionSquare.bottomRight.y = mouseY;
				}
				else //mouseY <= selectionSquare.bottomRight.y //mouse is above and to the right of selectionSquare.topLeft
				{
					selectionSquare.bottomRight.x = mouseX;
					selectionSquare.topLeft.y = mouseY;					
				}
			}
			else // mouseX <= selectionSquare.topLeft.x
			{
				if (mouseY > selectionSquare.bottomRight.y) //mouse is below and to the left of selectionSquare.topLeft
				{
					selectionSquare.topLeft.x = mouseX;
					selectionSquare.bottomRight.y = mouseY;
				}
				else //mouseY <= selectionSquare.bottomRight.y //mouse is above and to the left of selectionSquare.topLeft
				{
					selectionSquare.topLeft.x = mouseX;
					selectionSquare.topLeft.y = mouseY;				
				}
			}
			updatePage();
			//drawPatternToCanvas(c, p);
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

	if (stitchPointHeld == true) //holding/moving a StitchPoint
	{
		stitchPointHeld = false;
		document.body.style.cursor = "grab";
	}
	else if (selectionSquare.exists == true)
	{
		selectionSquare.exists = false;
		//MAYBE SHOULD REDRAW OR UPDATE HERE?
	}
});


//listen for delete button
document.onkeydown = function(evnt)
{
	if (evnt.key === "Delete")
		deleteSelectedStitch();
};


//listener for delete stitch button
document.getElementById("DeleteStitchButton").addEventListener("click", function(evnt)
{
	deleteSelectedStitch();
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