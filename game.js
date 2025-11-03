const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// ---- Load image assets ----
const planeImg = new Image(); planeImg.src = "plane.png";
const bombImg = new Image(); bombImg.src = "bomb.png";
const terrainImg = new Image(); terrainImg.src = "terrain.png";
const explosionImg = new Image(); explosionImg.src = "explosion.png";
const tankImg = new Image(); tankImg.src = "tank.png";
const fuelcanImg = new Image(); fuelcanImg.src = "fuelcan.png";

// ---- Terrain ----
function genTerrain(width, height, segments) {
  let arr = [];
  let lastY = height - 120;
  for (let i = 0; i <= segments; i++) {
    let nY = lastY + (Math.random() - 0.5) * 38;
    nY = Math.max(height-190, Math.min(height-50, nY));
    arr.push({x: i * (width/segments), y: nY});
    lastY = nY;
  }
  return arr;
}

function drawTerrain(arr) {
  // Stretch terrain image between each segment
  for (let i=0; i<arr.length-1; i++) {
    let p0=arr[i], p1=arr[i+1];
    let w=p1.x-p0.x, h=canvas.height-p0.y;
    ctx.drawImage(terrainImg, p0.x, p0.y, w, h);
  }
  // Optionally, draw outline for debug:
  // ctx.beginPath();
  // for (let p of arr) ctx.lineTo(p.x, p.y);
  // ctx.strokeStyle="#20531c";ctx.lineWidth=2;ctx.stroke();
}

// Ray hit test for terrain collision
function planeHitTerrain(plane, terrain) {
  const px = plane.x, py = plane.y+14; // lower plane edge
  for (let i = 0; i < terrain.length-1; i++) {
    let p0 = terrain[i], p1 = terrain[i+1];
    if (px >= p0.x && px <= p1.x) {
      // Linear interp
      let ty = p0.y + (p1.y-p0.y) * ((px-p0.x)/(p1.x-p0.x));
      if (py > ty) return true;
    }
  }
  return false;
}

// ---- Game objects ----
let keys = {};
let mouse = {x: 450, y: 120};
let useMouse = false;
let bombs = [];
let explosions = [];
let tanks = [];
let fuelCans = [];
let terrain = genTerrain(canvas.width, canvas.height, 35);

// ---- Player ----
let plane = {
  x: 450, y: 90, speed: 4, dir: 0, alive: true, fuel: 120, score: 0
};

// ---- Spawning ----
function respawnTank() {
  let x = Math.random()*(canvas.width-80)+40;
  tanks.push({x: x, y: terrainY(x)-26, alive: true});
}
function respawnFuel() {
  let x = Math.random()*(canvas.width-120)+60;
  fuelCans.push({x: x, y: terrainY(x)-16, alive: true});
}
function terrainY(x) {
  for (let i = 0; i < terrain.length-1; i++) {
    let p0 = terrain[i], p1 = terrain[i+1];
    if (x >= p0.x && x <= p1.x)
      return p0.y + (p1.y-p0.y) * ((x-p0.x)/(p1.x-p0.x));
  }
  return canvas.height-50;
}

// ---- Controls ----
window.addEventListener("keydown", e => {
  keys[e.key.toLowerCase()] = true;
  if (e.key.toLowerCase() === "m") useMouse = !useMouse;
  if (e.key === " " && plane.alive) dropBomb();
});
window.addEventListener("keyup", e => keys[e.key.toLowerCase()] = false);
canvas.addEventListener("mousemove", e => {
  const rect = canvas.getBoundingClientRect();
  mouse.x = e.clientX - rect.left; mouse.y = e.clientY - rect.top;
});
canvas.addEventListener("click", dropBomb);

// ---- Actions ----
function dropBomb() {
  if (!plane.alive) return;
  bombs.push({x: plane.x, y: plane.y+14, speed: 5, exploded: false});
}

// ---- Main Loop ----
function gameLoop() {
  update();
  draw();
  requestAnimationFrame(gameLoop);
}

// ---- Update ----
function update() {
  if (!plane.alive) return;

  plane.fuel -= 0.09;
  if (plane.fuel <= 0) { plane.alive = false; }

  if (useMouse) {
    plane.x += (mouse.x-plane.x)*0.09;
    plane.y += (mouse.y-plane.y)*0.09;
    let dx = (mouse.x-plane.x), dy = (mouse.y-plane.y);
    plane.dir = Math.atan2(dy, dx) * 0.5;
  } else {
    if (keys["a"]||keys["arrowleft"]) plane.x -= plane.speed;
    if (keys["d"]||keys["arrowright"]) plane.x += plane.speed;
    if (keys["w"]||keys["arrowup"]) plane.y -= plane.speed;
    if (keys["s"]||keys["arrowdown"]) plane.y += plane.speed;
    plane.dir = 0;
  }

  plane.x = Math.max(32, Math.min(canvas.width-32, plane.x));
  plane.y = Math.max(32, Math.min(canvas.height-36, plane.y));

  if (planeHitTerrain(plane, terrain)) plane.alive = false;

  for (let bomb of bombs) {
    bomb.y += bomb.speed;
    const by = terrainY(bomb.x);
    if (bomb.y > by-4 && !bomb.exploded) {
      bomb.exploded = true;
      explosions.push({x:bomb.x, y:by-2, radius:3, life:18});
      tanks.forEach(t=>{
        const dist = Math.hypot(t.x-bomb.x,t.y-bomb.y);
        if (dist<32&&t.alive) {t.alive=false; plane.score+=50;}
      });
    }
  }
  bombs = bombs.filter(b => b.y < canvas.height && !b.exploded);

  for (let ex of explosions) {
    ex.radius += 2;
    ex.life -= 1;
  }
  explosions = explosions.filter(e => e.life > 0);

  tanks = tanks.filter(t=>t.alive);
  while (tanks.length < 4) respawnTank();

  fuelCans = fuelCans.filter(t=>t.alive);
  while (fuelCans.length < 2) respawnFuel();
  fuelCans.forEach(f=>{
    const dist = Math.hypot(f.x-plane.x,f.y-plane.y);
    if (dist<24&&f.alive) {f.alive=false; plane.fuel+=60;}
  });
}

// ---- Draw everything ----
function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  drawTerrain(terrain);

  for (let tank of tanks) {
    if (tank.alive)
      ctx.drawImage(tankImg, tank.x-18, tank.y-12, 36, 24);
  }

  for (let f of fuelCans) {
    if (f.alive)
      ctx.drawImage(fuelcanImg, f.x-13, f.y-13, 26, 26);
  }

  for (let bomb of bombs)
    ctx.drawImage(bombImg, bomb.x-8, bomb.y-8, 16, 16);

  for (let ex of explosions)
    ctx.drawImage(explosionImg, ex.x-ex.radius, ex.y-ex.radius, ex.radius*2, ex.radius*2);

  if (plane.alive) {
    ctx.save();
    ctx.translate(plane.x, plane.y);
    ctx.rotate(plane.dir);
    ctx.drawImage(planeImg, -32, -16, 64, 32);
    ctx.restore();
  }

  ctx.font="bold 24px monospace";
  ctx.fillStyle = "#fff";
  ctx.fillText(`Score: ${plane.score}`, 30, 38);
  ctx.fillText(`Fuel: ${plane.fuel.toFixed(0)}`, 220, 38);
  ctx.fillText(`Bombs: ∞`, 430, 38);
  ctx.fillText(`Control: ${useMouse ? "Mouse" : "WASD/Arrow"}`, 640, 38);

  if (!plane.alive) {
    ctx.font = "bold 48px monospace";
    ctx.fillStyle = "#fad932";
    ctx.fillText("GAME OVER", canvas.width/2-150, canvas.height/2-20);
    ctx.font = "bold 30px monospace";
    ctx.fillStyle = "#fff";
    ctx.fillText(`Final score: ${plane.score}`, canvas.width/2-110, canvas.height/2+38);
    ctx.fillText("Refresh to play again!", canvas.width/2-130, canvas.height/2+78);
  }
}

gameLoop();
