// game.js
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// ---- Asset placeholders (swap for PNG sprites later) ----
function drawPlane(x, y, direction) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(direction);
  ctx.fillStyle = "#eaeaea";
  ctx.fillRect(-32, -12, 64, 24); // body
  ctx.fillStyle = "#5077bb";
  ctx.fillRect(-28, -8, 12, 16); // tail
  ctx.restore();
}

function drawBomb(x, y) {
  ctx.beginPath();
  ctx.arc(x, y, 8, 0, Math.PI * 2); ctx.fillStyle = "#222"; ctx.fill();
  ctx.strokeStyle = "#444"; ctx.lineWidth = 2; ctx.stroke();
}

function drawExplosion(x, y, radius) {
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.fillStyle = "#fce354"; ctx.fill();
  ctx.globalAlpha = 0.6;
  ctx.beginPath();
  ctx.arc(x, y, radius * 1.5, 0, Math.PI * 2); ctx.fillStyle = "#fa825a"; ctx.fill();
  ctx.globalAlpha = 1;
}

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
  ctx.beginPath();
  ctx.moveTo(0, canvas.height);
  for (let p of arr) ctx.lineTo(p.x, p.y);
  ctx.lineTo(canvas.width, canvas.height);
  ctx.closePath();
  ctx.fillStyle = "#2f5b25";
  ctx.fill();
  ctx.strokeStyle = "#20531c"; ctx.lineWidth = 4;
  ctx.stroke();
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
  // Get terrain Y for any X (linear interp between points)
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

  plane.fuel -= 0.09; // Fuel drains slowly
  if (plane.fuel <= 0) { plane.alive = false; }

  // Move
  if (useMouse) { // Mouse follows smoothly
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

  // Terrain collision
  if (planeHitTerrain(plane, terrain)) plane.alive = false;

  // Bombs update
  for (let bomb of bombs) {
    bomb.y += bomb.speed;
    // Hit terrain
    const by = terrainY(bomb.x);
    if (bomb.y > by-4 && !bomb.exploded) {
      bomb.exploded = true;
      explosions.push({x:bomb.x, y:by-2, radius:3, life:18});
      // Destroy tanks
      tanks.forEach(t=>{
        const dist = Math.hypot(t.x-bomb.x,t.y-bomb.y);
        if (dist<32&&t.alive) {t.alive=false; plane.score+=50;}
      });
    }
  }
  bombs = bombs.filter(b => b.y < canvas.height && !b.exploded);

  // Explosions animate
  for (let ex of explosions) {
    ex.radius += 2;
    ex.life -= 1;
  }
  explosions = explosions.filter(e => e.life > 0);

  tanks = tanks.filter(t=>t.alive);
  while (tanks.length < 4) respawnTank();

  // Fuel cans
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

  // Draw tanks
  for (let tank of tanks) {
    if (tank.alive)
      ctx.fillStyle = "#be230b", ctx.fillRect(tank.x-18, tank.y-12, 36, 16),
      ctx.fillStyle = "#533", ctx.fillRect(tank.x-6, tank.y-24,12,12),
      ctx.font="12px monospace",ctx.fillStyle="#fff",ctx.fillText("TANK",tank.x-15,tank.y-16);
  }

  // Draw fuel cans
  for (let f of fuelCans) {
    if (f.alive)
      ctx.fillStyle = "#ffee10", ctx.beginPath(), ctx.arc(f.x, f.y, 13, 0, Math.PI*2), ctx.fill(),
      ctx.font="12px monospace",ctx.fillStyle="#111",ctx.fillText("Fuel",f.x-13,f.y+5);
  }

  // Draw bombs
  for (let bomb of bombs)
    drawBomb(bomb.x, bomb.y);

  // Explosions
  for (let ex of explosions)
    drawExplosion(ex.x, ex.y, ex.radius);

  // Draw plane
  if (plane.alive) drawPlane(plane.x, plane.y, plane.dir);

  // HUD
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

// Launch!
gameLoop();
