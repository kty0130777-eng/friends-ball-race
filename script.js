/**
 * ====================================================================
 * 친구들 공 레이스! 누가 당번일까?
 * 순수 JavaScript (Vanilla JS), HTML5 Canvas 물리 엔진 및 UI 제어
 * ====================================================================
 */

// --- 1. 색상 및 캐릭터 프리셋 팔레트 ---
const BALL_PALETTES = [
  { name: '핑크베리', primary: '#f43f5e', secondary: '#fda4af', shadow: '#9f1239' },
  { name: '스카이블루', primary: '#0ea5e9', secondary: '#7dd3fc', shadow: '#0369a1' },
  { name: '선샤인옐로', primary: '#eab308', secondary: '#fef08a', shadow: '#a16207' },
  { name: '민트라임', primary: '#10b981', secondary: '#a7f3d0', shadow: '#047857' },
  { name: '바이올렛', primary: '#8b5cf6', secondary: '#ddd6fe', shadow: '#5b21b6' },
  { name: '탱고오렌지', primary: '#f97316', secondary: '#fed7aa', shadow: '#c2410c' },
  { name: '체리레드', primary: '#e11d48', secondary: '#fecdd3', shadow: '#881337' },
  { name: '에메랄드', primary: '#059669', secondary: '#6ee7b7', shadow: '#064e3b' },
  { name: '인디고', primary: '#4f46e5', secondary: '#c7d2fe', shadow: '#312e81' },
  { name: '코랄핑크', primary: '#fb7185', secondary: '#ffe4e6', shadow: '#be123c' },
  { name: '망고골드', primary: '#f59e0b', secondary: '#fde68a', shadow: '#b45309' },
  { name: '청록사이언', primary: '#06b6d4', secondary: '#a5f3fc', shadow: '#0e7490' },
  { name: '라벤더', primary: '#a855f7', secondary: '#e9d5ff', shadow: '#6b21a8' },
  { name: '버블검', primary: '#ec4899', secondary: '#fbcfe8', shadow: '#9d174d' },
  { name: '포레스트', primary: '#15803d', secondary: '#bbf7d0', shadow: '#14532d' },
  { name: '딥퍼플', primary: '#7c3aed', secondary: '#c4b5fd', shadow: '#4c1d95' }
];

// 표정 유형 (0: 반짝이, 1: 윙크, 2: 활짝 웃음, 3: 놀람, 4: 냐옹 입, 5: 당당)
// 장식 유형 (0: 고양이귀, 1: 곰돌이귀, 2: 새싹, 3: 별핀, 4: 리본, 5: 미니왕관, 6: 안경, 7: 헤드폰, 8: 꽃핀)

// 샘플 친구 이름 목록
const SAMPLE_NAMES = ['철수', '영희', '민수', '수진', '지훈'];

// --- 2. 오디오 합성기 (Web Audio API) ---
class SoundManager {
  constructor() {
    this.ctx = null;
    this.enabled = true;
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  toggle() {
    this.enabled = !this.enabled;
    return this.enabled;
  }

  playBeep(freq = 440, type = 'sine', duration = 0.15, gainVal = 0.15) {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      gain.gain.setValueAtTime(gainVal, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch (e) {
      // Audio autoplay policy fallback
    }
  }

  playBounce(intensity = 1) {
    if (!this.enabled) return;
    const freq = 260 + Math.random() * 220;
    this.playBeep(freq, 'triangle', 0.08, Math.min(0.2, 0.08 * intensity));
  }

  playBooster() {
    if (!this.enabled) return;
    this.playBeep(580, 'sine', 0.1, 0.12);
  }

  playCheer() {
    if (!this.enabled) return;
    // 경쾌한 도착 차임
    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
    notes.forEach((freq, idx) => {
      setTimeout(() => {
        this.playBeep(freq, 'sine', 0.25, 0.18);
      }, idx * 75);
    });
  }

  playFanfare() {
    if (!this.enabled) return;
    // 최종 경기 종료 팡파르
    const fanfareNotes = [440, 554.37, 659.25, 880, 880, 1108.73];
    const delays = [0, 120, 240, 360, 480, 600];
    fanfareNotes.forEach((freq, idx) => {
      setTimeout(() => {
        this.playBeep(freq, 'triangle', 0.35, 0.22);
      }, delays[idx]);
    });
  }
}

const sounds = new SoundManager();

// --- 3. 참여자 관리 상태 ---
const state = {
  participants: [],
  gameState: 'WAITING', // 'WAITING', 'COUNTDOWN', 'RACING', 'PAUSED', 'FINISHED'
  timeScale: 1.0,
  balls: [],
  obstacles: [],
  particles: [],
  confettiList: [],
  finishedBalls: [],
  raceStartTime: 0,
  countdownTimer: null,
  countdownNumber: 3,
  animationId: null,
  nextColorIndex: 0
};

// DOM 요소 캐싱
const elements = {
  nameInput: document.getElementById('nameInput'),
  addBtn: document.getElementById('addBtn'),
  inputErrorMsg: document.getElementById('inputErrorMsg'),
  quickSampleBtn: document.getElementById('quickSampleBtn'),
  shuffleBtn: document.getElementById('shuffleBtn'),
  clearAllBtn: document.getElementById('clearAllBtn'),
  participantList: document.getElementById('participantList'),
  participantCountBadge: document.getElementById('participantCountBadge'),
  emptyListNotice: document.getElementById('emptyListNotice'),
  
  startBtn: document.getElementById('startBtn'),
  pauseBtn: document.getElementById('pauseBtn'),
  pauseIcon: document.getElementById('pauseIcon'),
  restartBtn: document.getElementById('restartBtn'),
  soundToggleBtn: document.getElementById('soundToggleBtn'),
  soundIcon: document.getElementById('soundIcon'),
  
  raceStatusBadge: document.getElementById('raceStatusBadge'),
  liveRankList: document.getElementById('liveRankList'),
  
  canvas: document.getElementById('raceCanvas'),
  canvasWrapper: document.getElementById('canvasWrapper'),
  countdownOverlay: document.getElementById('countdownOverlay'),
  countdownText: document.getElementById('countdownText'),
  guideOverlay: document.getElementById('guideOverlay'),
  guidePreview: document.getElementById('guidePreview'),
  
  speedBtns: document.querySelectorAll('.speed-btn'),
  
  winnerModal: document.getElementById('winnerModal'),
  winnerNameDisplay: document.getElementById('winnerNameDisplay'),
  winnerBallPreview: document.getElementById('winnerBallPreview'),
  finalRankingBody: document.getElementById('finalRankingBody'),
  modalRestartBtn: document.getElementById('modalRestartBtn'),
  modalCloseBtn: document.getElementById('modalCloseBtn'),
  confettiCanvas: document.getElementById('confettiCanvas')
};

const ctx = elements.canvas.getContext('2d');
const confettiCtx = elements.confettiCanvas.getContext('2d');

// --- 4. 캐릭터 공(Ball) 클래스 ---
class Ball {
  constructor(id, name, palette, faceType, accessory, x, y) {
    this.id = id;
    this.name = name;
    this.palette = palette;
    this.faceType = faceType;
    this.accessory = accessory;
    
    this.radius = 17; // 또렷하고 둥근 동그라미 크기
    this.x = x;
    this.y = y;
    this.vx = (Math.random() - 0.5) * 1.5;
    this.vy = 0;
    this.angle = 0;
    this.angularVelocity = 0;
    
    this.finished = false;
    this.finishTime = 0;
    this.rank = 0;
    
    // 구조물 사이에 걸림 방지 및 100% 무결점 하방 진행 와치독
    this.lastProgressY = y;
    this.timeSinceProgress = 0;
  }

  update(dt, gravity, bounds) {
    if (this.finished) {
      // 결승선 통과 후 완주 구역에서 부드럽게 멈춤
      this.vy += gravity * 0.4 * dt;
      this.vx *= 0.94;
      this.vy *= 0.94;
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      this.angle += this.vx * 0.04;
      
      // 결승선 아래 바닥 충돌
      if (this.y > bounds.bottom - this.radius) {
        this.y = bounds.bottom - this.radius;
        this.vy = -this.vy * 0.3;
      }
      if (this.x < bounds.left + this.radius) {
        this.x = bounds.left + this.radius;
        this.vx = -this.vx * 0.5;
      }
      if (this.x > bounds.right - this.radius) {
        this.x = bounds.right - this.radius;
        this.vx = -this.vx * 0.5;
      }
      return;
    }

    // 중력 및 공기 저항 적용 (순식간에 끝나지 않고 약 25~35초간 박진감 넘치게 굴러가도록 조정)
    this.vy += gravity * dt;
    this.vx *= 0.995;
    this.vy *= 0.996;

    // 최대 낙하 속도 제한 (묵직하고 롤링 위주의 레이스 연출)
    const maxSpeed = 3.6;
    const speed = Math.hypot(this.vx, this.vy);
    if (speed > maxSpeed) {
      this.vx = (this.vx / speed) * maxSpeed;
      this.vy = (this.vy / speed) * maxSpeed;
    }

    this.x += this.vx * dt;
    this.y += this.vy * dt;

    // 굴러가는 회전 각도 (속도에 비례해 자연스럽게 회전)
    this.angle += (this.vx * 0.055);

    // 좌우 벽면 충돌 (순수 원형 반사)
    if (this.x - this.radius < bounds.left) {
      this.x = bounds.left + this.radius;
      this.vx = Math.abs(this.vx) * 0.75 + 0.3;
      sounds.playBounce(0.6);
    } else if (this.x + this.radius > bounds.right) {
      this.x = bounds.right - this.radius;
      this.vx = -Math.abs(this.vx) * 0.75 - 0.3;
      sounds.playBounce(0.6);
    }

    // 100% 무결점 끼임 탈출 와치독 (진행이 정체되면 단계별로 즉시 탈출)
    if (this.y > this.lastProgressY + 6) {
      this.lastProgressY = this.y;
      this.timeSinceProgress = 0;
    } else {
      this.timeSinceProgress += dt;
    }

    // 1단계 탈출 (약 1.3초간 하방 전진 없을 시 가볍게 흔들어 탈출)
    if (this.timeSinceProgress > 80 && this.timeSinceProgress <= 140) {
      this.vx += (Math.random() - 0.5) * 2.8;
      this.vy += 1.6;
    }
    // 2단계 탈출 (약 2.3초간 전진 없을 시 강력한 점프 및 횡방향 반발)
    else if (this.timeSinceProgress > 140 && this.timeSinceProgress <= 200) {
      const escapeDir = this.x > 300 ? -1 : 1;
      this.vx = escapeDir * (3.0 + Math.random() * 2);
      this.vy = Math.max(this.vy, 3.8);
      createHitParticles(this.x, this.y, '#f59e0b');
    }
    // 3단계 탈출 (약 3.3초 이상 진행 불가 시 하방 순간 슬립 관통 탈출)
    else if (this.timeSinceProgress > 200) {
      this.y += 24;
      this.vy = 4.2;
      this.vx = (Math.random() - 0.5) * 3;
      this.lastProgressY = this.y;
      this.timeSinceProgress = 0;
      createHitParticles(this.x, this.y, '#ec4899');
      sounds.playBounce(1.2);
    }
  }

  draw(context, showCrown = false) {
    context.save();
    context.translate(this.x, this.y);

    // 1. 공 원형 그림자 (바닥에 깔리는 부드러운 원형 그림자)
    context.beginPath();
    context.arc(0, this.radius * 0.75, this.radius * 0.65, 0, Math.PI * 2);
    context.fillStyle = 'rgba(0, 0, 0, 0.22)';
    context.fill();

    // 실시간 레이스 선두(1등)인 경우 황금 아우라 링 효과 표시 (역전 순간 한눈에 파악!)
    if (this.isLeader && state.gameState === 'RACING') {
      context.save();
      context.beginPath();
      context.arc(0, 0, this.radius + 3.5, 0, Math.PI * 2);
      context.strokeStyle = 'rgba(251, 191, 36, 0.85)';
      context.lineWidth = 3;
      context.stroke();
      context.restore();
    }

    // 2. 굴러가는 공 본체 (회전 적용, 완벽한 동그라미 원형 보장)
    context.save();
    context.rotate(this.angle);

    // 3D 구체 입체 원형 그라디언트
    const sphereGrad = context.createRadialGradient(
      -this.radius * 0.35, -this.radius * 0.35, this.radius * 0.05,
      0, 0, this.radius
    );
    sphereGrad.addColorStop(0, '#ffffff'); // 반사 하이라이트
    sphereGrad.addColorStop(0.2, this.palette.secondary);
    sphereGrad.addColorStop(0.7, this.palette.primary);
    sphereGrad.addColorStop(1, this.palette.shadow);

    // 완전한 원형(동그라미) 바디
    context.beginPath();
    context.arc(0, 0, this.radius, 0, Math.PI * 2);
    context.fillStyle = sphereGrad;
    context.fill();

    // 또렷하고 둥근 외곽선
    context.lineWidth = 1.8;
    context.strokeStyle = 'rgba(255, 255, 255, 0.85)';
    context.stroke();

    // 3D 원형 유리광택 하이라이트 (동그란 형태감 강조)
    context.beginPath();
    context.arc(-this.radius * 0.35, -this.radius * 0.35, this.radius * 0.26, 0, Math.PI * 2);
    context.fillStyle = 'rgba(255, 255, 255, 0.72)';
    context.fill();

    // 작은 핀포인트 반짝이 광택
    context.beginPath();
    context.arc(-this.radius * 0.2, -this.radius * 0.2, this.radius * 0.1, 0, Math.PI * 2);
    context.fillStyle = '#ffffff';
    context.fill();

    // 아래쪽 부드러운 림라이트 반사광
    context.beginPath();
    context.arc(this.radius * 0.25, this.radius * 0.25, this.radius * 0.28, 0, Math.PI * 2);
    context.fillStyle = 'rgba(255, 255, 255, 0.12)';
    context.fill();

    // 귀여운 원형 얼굴 표정 그리기 (동그라미 내부에 예쁘게 배치)
    this.drawFace(context);

    context.restore(); // 회전 해제

    // 3. 우승 왕관 또는 레이스 실시간 선두 왕관
    if (showCrown || (this.rank === 1 && this.finished)) {
      this.drawCrown(context, 0, -this.radius - 18, 1);
    } else if (this.isLeader && state.gameState === 'RACING') {
      this.drawCrown(context, 0, -this.radius - 16, 0.75);
    }

    // 4. 이름 명찰 태그 (항상 수평 유지하여 가독성 보장)
    this.drawNameTag(context);

    context.restore();
  }

  drawCrown(context, cx, cy, scale = 1) {
    context.save();
    context.translate(cx, cy);
    context.scale(scale, scale);
    context.fillStyle = '#f59e0b';
    context.strokeStyle = '#b45309';
    context.lineWidth = 1.2;

    context.beginPath();
    context.moveTo(-9, 4);
    context.lineTo(-11, -5);
    context.lineTo(-4, 0);
    context.lineTo(0, -9);
    context.lineTo(4, 0);
    context.lineTo(11, -5);
    context.lineTo(9, 4);
    context.closePath();
    context.fill();
    context.stroke();

    // 보석 포인트
    context.fillStyle = '#ef4444';
    context.beginPath();
    context.arc(0, -2, 1.8, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#38bdf8';
    context.beginPath();
    context.arc(-5.5, 0, 1.4, 0, Math.PI * 2);
    context.fill();
    context.beginPath();
    context.arc(5.5, 0, 1.4, 0, Math.PI * 2);
    context.fill();

    context.restore();
  }

  drawStar(context, cx, cy, spikes, outerRadius, innerRadius) {
    let rot = (Math.PI / 2) * 3;
    let x = cx;
    let y = cy;
    const step = Math.PI / spikes;

    context.beginPath();
    context.moveTo(cx, cy - outerRadius);
    for (let i = 0; i < spikes; i++) {
      x = cx + Math.cos(rot) * outerRadius;
      y = cy + Math.sin(rot) * outerRadius;
      context.lineTo(x, y);
      rot += step;

      x = cx + Math.cos(rot) * innerRadius;
      y = cy + Math.sin(rot) * innerRadius;
      context.lineTo(x, y);
      rot += step;
    }
    context.lineTo(cx, cy - outerRadius);
    context.closePath();
  }

  drawFace(context) {
    const eyeY = -1;
    const eyeSpacing = 5.2;

    // 1. 발그레 볼터치 (모든 표정에 귀엽게 적용)
    context.fillStyle = 'rgba(255, 99, 132, 0.45)';
    context.beginPath();
    context.arc(-eyeSpacing - 3, 3, 2.8, 0, Math.PI * 2);
    context.fill();
    context.beginPath();
    context.arc(eyeSpacing + 3, 3, 2.8, 0, Math.PI * 2);
    context.fill();

    // 2. 표정별 눈 & 입
    switch (this.faceType % 6) {
      case 0: // 반짝반짝 큰 눈 & 미소
        this.drawSparkleEye(context, -eyeSpacing, eyeY);
        this.drawSparkleEye(context, eyeSpacing, eyeY);
        // 입
        context.strokeStyle = '#1e293b';
        context.lineWidth = 1.3;
        context.beginPath();
        context.arc(0, 1.5, 2.5, 0.1, Math.PI - 0.1);
        context.stroke();
        break;

      case 1: // 윙크 & 장난기 입
        // 왼쪽 윙크
        context.strokeStyle = '#1e293b';
        context.lineWidth = 1.6;
        context.beginPath();
        context.arc(-eyeSpacing, eyeY, 3, Math.PI * 1.15, Math.PI * 1.85);
        context.stroke();
        // 오른쪽 반짝이 눈
        this.drawSparkleEye(context, eyeSpacing, eyeY);
        // 메롱 입
        context.beginPath();
        context.arc(0, 1.8, 2.4, 0, Math.PI);
        context.fillStyle = '#ef4444';
        context.fill();
        context.stroke();
        break;

      case 2: // 활짝 웃는 눈 (^ ^) & 벌린 입
        context.strokeStyle = '#1e293b';
        context.lineWidth = 1.6;
        context.beginPath();
        context.arc(-eyeSpacing, eyeY + 1, 3, Math.PI * 1.15, Math.PI * 1.85);
        context.stroke();
        context.beginPath();
        context.arc(eyeSpacing, eyeY + 1, 3, Math.PI * 1.15, Math.PI * 1.85);
        context.stroke();
        // 하하 벌린 입
        context.fillStyle = '#b91c1c';
        context.beginPath();
        context.arc(0, 2, 3.2, 0, Math.PI);
        context.fill();
        break;

      case 3: // 땡그란 놀란 눈 & 동그란 입
        context.fillStyle = '#0f172a';
        context.beginPath();
        context.arc(-eyeSpacing, eyeY, 2.8, 0, Math.PI * 2);
        context.arc(eyeSpacing, eyeY, 2.8, 0, Math.PI * 2);
        context.fill();
        // 하이라이트
        context.fillStyle = '#ffffff';
        context.beginPath();
        context.arc(-eyeSpacing - 0.8, eyeY - 0.8, 1.1, 0, Math.PI * 2);
        context.arc(eyeSpacing - 0.8, eyeY - 0.8, 1.1, 0, Math.PI * 2);
        context.fill();
        // 'O' 입
        context.strokeStyle = '#0f172a';
        context.lineWidth = 1.2;
        context.beginPath();
        context.arc(0, 3.5, 1.8, 0, Math.PI * 2);
        context.stroke();
        break;

      case 4: // 고양이 입 (:3)
        this.drawSparkleEye(context, -eyeSpacing, eyeY);
        this.drawSparkleEye(context, eyeSpacing, eyeY);
        // 고양이 w 입
        context.strokeStyle = '#1e293b';
        context.lineWidth = 1.3;
        context.beginPath();
        context.arc(-1.4, 2.2, 1.6, 0, Math.PI);
        context.stroke();
        context.beginPath();
        context.arc(1.4, 2.2, 1.6, 0, Math.PI);
        context.stroke();
        break;

      case 5: // 당당한 눈썹과 자신감 미소
        // 눈
        this.drawSparkleEye(context, -eyeSpacing, eyeY);
        this.drawSparkleEye(context, eyeSpacing, eyeY);
        // 당당 눈썹
        context.strokeStyle = '#1e293b';
        context.lineWidth = 1.2;
        context.beginPath();
        context.moveTo(-eyeSpacing - 2, eyeY - 4);
        context.lineTo(-eyeSpacing + 2.5, eyeY - 3);
        context.stroke();
        context.beginPath();
        context.moveTo(eyeSpacing + 2, eyeY - 4);
        context.lineTo(eyeSpacing - 2.5, eyeY - 3);
        context.stroke();
        // 씩 웃는 입
        context.beginPath();
        context.arc(0.5, 1.5, 2.6, 0.2, Math.PI * 0.9);
        context.stroke();
        break;
    }
  }

  drawSparkleEye(context, ex, ey) {
    context.fillStyle = '#0f172a';
    context.beginPath();
    context.arc(ex, ey, 3.2, 0, Math.PI * 2);
    context.fill();
    // 큰 반짝이
    context.fillStyle = '#ffffff';
    context.beginPath();
    context.arc(ex - 1, ey - 1, 1.3, 0, Math.PI * 2);
    context.fill();
    // 작은 반짝이
    context.beginPath();
    context.arc(ex + 1.1, ey + 1, 0.7, 0, Math.PI * 2);
    context.fill();
  }

  drawNameTag(context) {
    const text = this.finished ? `${this.rank}등 ${this.name}` : this.name;
    context.font = 'bold 11px Pretendard, sans-serif';
    const textWidth = context.measureText(text).width;
    const tagWidth = textWidth + 14;
    const tagHeight = 18;
    const tagY = -this.radius - 12;

    // 명찰 배경 박스
    context.fillStyle = this.finished ? '#ecfdf5' : 'rgba(255, 255, 255, 0.92)';
    context.strokeStyle = this.finished ? '#10b981' : this.palette.primary;
    context.lineWidth = 1.4;

    context.beginPath();
    context.roundRect(-tagWidth / 2, tagY - tagHeight / 2, tagWidth, tagHeight, 8);
    context.fill();
    context.stroke();

    // 명찰 텍스트
    context.fillStyle = this.finished ? '#065f46' : '#1e293b';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(text, 0, tagY);
  }
}

// --- 5. 장애물 클래스들 ---

// 원형 범퍼 장애물
class Bumper {
  constructor(x, y, radius, color = '#6366f1') {
    this.x = x;
    this.y = y;
    this.baseX = x;
    this.baseRadius = radius;
    this.radius = radius;
    this.color = color;
    this.pulse = 0;
    this.oscillates = false;
    this.oscSpeed = 0.024;
    this.oscAmp = 22;
    this.oscPhase = Math.random() * Math.PI * 2;
  }

  update(dt) {
    if (this.oscillates) {
      this.oscPhase += this.oscSpeed * dt;
      this.x = this.baseX + Math.sin(this.oscPhase) * this.oscAmp;
    }
    if (this.pulse > 0) {
      this.pulse -= dt * 0.08;
      if (this.pulse < 0) this.pulse = 0;
      this.radius = this.baseRadius * (1 + this.pulse * 0.3);
    }
  }

  onHit() {
    this.pulse = 1;
    sounds.playBounce(1.5);
  }

  draw(context) {
    context.save();
    // 범퍼 외곽 글로우
    if (this.pulse > 0) {
      context.beginPath();
      context.arc(this.x, this.y, this.radius + 6, 0, Math.PI * 2);
      context.fillStyle = 'rgba(236, 72, 153, 0.4)';
      context.fill();
    }

    // 메인 범퍼
    const grad = context.createRadialGradient(
      this.x - this.radius * 0.3, this.y - this.radius * 0.3, 2,
      this.x, this.y, this.radius
    );
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.5, this.color);
    grad.addColorStop(1, '#1e1b4b');

    context.beginPath();
    context.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    context.fillStyle = grad;
    context.fill();
    context.lineWidth = 2.5;
    context.strokeStyle = '#ffffff';
    context.stroke();

    // 중심 포인트
    context.beginPath();
    context.arc(this.x, this.y, this.radius * 0.35, 0, Math.PI * 2);
    context.fillStyle = '#fde047';
    context.fill();
    context.restore();
  }
}

// 회전 풍차 / 바람개비 스피너 장애물
class Spinner {
  constructor(x, y, bladeLength = 48, bladeWidth = 10, blades = 3, speed = 0.03) {
    this.x = x;
    this.y = y;
    this.bladeLength = bladeLength;
    this.bladeWidth = bladeWidth;
    this.blades = blades;
    this.angle = Math.random() * Math.PI * 2;
    this.speed = speed;
  }

  update(dt) {
    this.angle += this.speed * dt;
  }

  draw(context) {
    context.save();
    context.translate(this.x, this.y);
    context.rotate(this.angle);

    for (let i = 0; i < this.blades; i++) {
      const bAngle = (i * Math.PI * 2) / this.blades;
      context.save();
      context.rotate(bAngle);

      // 날개
      const grad = context.createLinearGradient(0, -this.bladeWidth / 2, this.bladeLength, this.bladeWidth / 2);
      grad.addColorStop(0, '#38bdf8');
      grad.addColorStop(1, '#818cf8');

      context.beginPath();
      context.roundRect(0, -this.bladeWidth / 2, this.bladeLength, this.bladeWidth, 6);
      context.fillStyle = grad;
      context.fill();
      context.lineWidth = 1.5;
      context.strokeStyle = '#ffffff';
      context.stroke();

      context.restore();
    }

    // 중심 캡
    context.beginPath();
    context.arc(0, 0, 11, 0, Math.PI * 2);
    context.fillStyle = '#f59e0b';
    context.fill();
    context.lineWidth = 2;
    context.strokeStyle = '#ffffff';
    context.stroke();

    context.restore();
  }
}

// 경사로 / 빗면 장애물 (선분 충돌체)
class Ramp {
  constructor(x1, y1, x2, y2, color = '#a78bfa') {
    this.x1 = x1;
    this.y1 = y1;
    this.x2 = x2;
    this.y2 = y2;
    this.color = color;
  }

  draw(context) {
    context.save();
    context.strokeStyle = this.color;
    context.lineWidth = 7;
    context.lineCap = 'round';
    context.beginPath();
    context.moveTo(this.x1, this.y1);
    context.lineTo(this.x2, this.y2);
    context.stroke();

    // 윗면 하이라이트
    context.strokeStyle = '#ffffff';
    context.lineWidth = 2;
    context.stroke();
    context.restore();
  }
}

// 가속 부스터 패드 (네온 런웨이 화살표, 통과 시 짜릿한 스피드 부스트와 추월 드라마 유도)
class BoostPad {
  constructor(x, y, width, height, dirX, dirY, boost = 2.4, color = '#10b981') {
    this.x = x;
    this.y = y;
    this.w = width;
    this.h = height;
    this.dirX = dirX;
    this.dirY = dirY;
    this.boost = boost;
    this.color = color;
    this.animOffset = 0;
  }

  update(dt) {
    this.animOffset = (this.animOffset + 0.12 * dt) % 1;
  }

  draw(context) {
    context.save();
    // 패드 발광 배경 박스
    context.fillStyle = 'rgba(16, 185, 129, 0.26)';
    context.strokeStyle = this.color;
    context.lineWidth = 1.8;
    context.beginPath();
    context.roundRect(this.x, this.y, this.w, this.h, 6);
    context.fill();
    context.stroke();

    // 네온 화살표 셰브론 (>>>) 흐름 애니메이션
    context.strokeStyle = '#ffffff';
    context.lineWidth = 2.2;
    context.lineCap = 'round';
    const chevrons = 3;
    const dx = this.dirX >= 0 ? 1 : -1;
    for (let i = 0; i < chevrons; i++) {
      const t = ((i / chevrons) + this.animOffset) % 1;
      const cx = this.x + (dx >= 0 ? t : (1 - t)) * this.w;
      const cy = this.y + this.h / 2;
      const arrowSize = 4.2;

      context.beginPath();
      context.moveTo(cx - dx * arrowSize, cy - arrowSize);
      context.lineTo(cx + dx * arrowSize, cy);
      context.lineTo(cx - dx * arrowSize, cy + arrowSize);
      context.stroke();
    }
    context.restore();
  }
}

// 충돌 스파크 파티클
class SparkParticle {
  constructor(x, y, color = '#fef08a') {
    this.x = x;
    this.y = y;
    this.vx = (Math.random() - 0.5) * 5;
    this.vy = (Math.random() - 0.5) * 5;
    this.color = color;
    this.alpha = 1;
    this.life = 1;
    this.size = 2 + Math.random() * 3;
  }

  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.life -= 0.05 * dt;
    this.alpha = Math.max(0, this.life);
  }

  draw(context) {
    context.save();
    context.globalAlpha = this.alpha;
    context.fillStyle = this.color;
    context.beginPath();
    context.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }
}

// --- 6. 트랙 맵 및 장애물 생성기 (4티어 와이드 슬라롬 & 핀볼 카오스 반전 코스) ---
function generateObstacles() {
  const obstacles = {
    bumpers: [],
    spinners: [],
    ramps: [],
    boostPads: []
  };

  // Zone 0: 시작 게이트 및 고른 분산 핀 (Y: 65 ~ 100)
  // 좌우 대칭 2개 핀으로 어느 슬롯에서 출발하든 100% 공평한 출발 보장!
  obstacles.ramps.push(new Ramp(0, 68, 175, 100, '#6366f1'));
  obstacles.ramps.push(new Ramp(600, 68, 425, 100, '#6366f1'));
  obstacles.bumpers.push(new Bumper(240, 85, 10, '#f59e0b'));
  obstacles.bumpers.push(new Bumper(360, 85, 10, '#f59e0b'));

  // Tier 1: 제1 슬라롬 트랙 (좌->우 슬라이드, Y: 110 ~ 185)
  obstacles.ramps.push(new Ramp(15, 115, 485, 185, '#38bdf8'));
  obstacles.ramps.push(new Ramp(590, 130, 535, 185, '#38bdf8'));
  obstacles.bumpers.push(new Bumper(210, 130, 10, '#ec4899'));
  obstacles.bumpers.push(new Bumper(360, 155, 10, '#f59e0b'));
  obstacles.boostPads.push(new BoostPad(420, 168, 42, 12, 1, 0.35, 2.3));

  // Tier 1->2 전환 스피너 & 가이드 (Y: 190 ~ 240)
  // 시계방향 회전: 공을 아래쪽과 왼쪽으로 안전하게 쓸어내림
  obstacles.spinners.push(new Spinner(485, 215, 36, 8, 3, 0.03));
  obstacles.bumpers.push(new Bumper(390, 215, 11, '#8b5cf6'));

  // Tier 2: 제2 슬라롬 트랙 (우->좌 슬라이드, Y: 225 ~ 300)
  obstacles.ramps.push(new Ramp(585, 230, 115, 300, '#f43f5e'));
  obstacles.ramps.push(new Ramp(15, 245, 65, 300, '#f43f5e'));
  obstacles.bumpers.push(new Bumper(430, 245, 10, '#10b981'));
  obstacles.bumpers.push(new Bumper(270, 270, 10, '#ec4899'));
  obstacles.boostPads.push(new BoostPad(145, 282, 42, 12, -1, 0.35, 2.3));

  // Tier 2->3 전환 스피너 (Y: 305 ~ 355)
  obstacles.spinners.push(new Spinner(115, 330, 36, 8, 3, -0.03));
  obstacles.bumpers.push(new Bumper(210, 330, 11, '#8b5cf6'));

  // Tier 3: 제3 슬라롬 트랙 (좌->우 슬라이드, Y: 340 ~ 415)
  obstacles.ramps.push(new Ramp(15, 345, 485, 415, '#10b981'));
  obstacles.ramps.push(new Ramp(590, 360, 535, 415, '#10b981'));
  obstacles.bumpers.push(new Bumper(200, 360, 10, '#ec4899'));
  obstacles.bumpers.push(new Bumper(370, 385, 10, '#f59e0b'));
  obstacles.boostPads.push(new BoostPad(420, 398, 42, 12, 1, 0.35, 2.3));

  // Tier 3->4 전환 스피너 (Y: 420 ~ 470)
  obstacles.spinners.push(new Spinner(485, 445, 36, 8, 3, 0.03));
  obstacles.bumpers.push(new Bumper(390, 445, 11, '#8b5cf6'));

  // Tier 4: 제4 슬라롬 트랙 (우->좌 슬라이드, Y: 455 ~ 530)
  obstacles.ramps.push(new Ramp(585, 460, 115, 530, '#8b5cf6'));
  obstacles.ramps.push(new Ramp(15, 475, 65, 530, '#8b5cf6'));
  obstacles.bumpers.push(new Bumper(430, 475, 10, '#10b981'));
  obstacles.bumpers.push(new Bumper(270, 500, 10, '#ec4899'));
  obstacles.boostPads.push(new BoostPad(145, 512, 42, 12, -1, 0.35, 2.3));

  // Zone 5: 핀볼 카오스 플링코 포레스트 (Y: 545 ~ 660, 3열 16개 네온 범퍼)
  const pinRows = [
    { y: 555, count: 5, startX: 80, gap: 110, r: 12, color: '#ec4899' },
    { y: 605, count: 6, startX: 45, gap: 102, r: 13, color: '#f59e0b' },
    { y: 655, count: 5, startX: 80, gap: 110, r: 12, color: '#06b6d4' }
  ];
  pinRows.forEach((row, rIdx) => {
    for (let i = 0; i < row.count; i++) {
      const b = new Bumper(row.startX + i * row.gap, row.y, row.r, row.color);
      // 중앙 범퍼 일부는 좌우로 부드럽게 흔들려 공의 궤적을 끊임없이 예측 불허로 만듦!
      if (rIdx === 1 && (i === 2 || i === 3)) {
        b.oscillates = true;
      }
      obstacles.bumpers.push(b);
    }
  });

  // Zone 6: 분기 갈림길 (Split Route, 좌/우 갈림길 & 가속 패드, Y: 675 ~ 735)
  obstacles.ramps.push(new Ramp(300, 675, 160, 725, '#f59e0b'));
  obstacles.ramps.push(new Ramp(300, 675, 440, 725, '#f59e0b'));
  obstacles.bumpers.push(new Bumper(300, 725, 18, '#f59e0b'));
  obstacles.boostPads.push(new BoostPad(130, 730, 42, 12, 0.6, 1, 2.8));
  obstacles.boostPads.push(new BoostPad(425, 730, 42, 12, -0.6, 1, 2.8));

  // Zone 7: 결승선 직전 라스트 스퍼트 / 대반전 삼각 범퍼 (Y: 745 ~ 795)
  // 결승선 바로 앞에서 선두를 튕겨내고 후발주자가 치고 나갈 수 있는 포토 피니시 룰렛!
  obstacles.ramps.push(new Ramp(0, 750, 170, 785, '#818cf8'));
  obstacles.ramps.push(new Ramp(600, 750, 430, 785, '#818cf8'));
  obstacles.bumpers.push(new Bumper(245, 760, 12, '#ec4899'));
  obstacles.bumpers.push(new Bumper(355, 760, 12, '#ec4899'));
  obstacles.bumpers.push(new Bumper(300, 775, 13, '#f59e0b'));

  return obstacles;
}

// --- 7. 물리 충돌 감지 및 응답 (예측 불가능한 탄성 충돌 & 상하좌우 반사) ---
function resolveCollisions(balls, obstacles) {
  for (const ball of balls) {
    if (ball.finished) continue;

    // 0. 가속 부스터 패드 충돌 (짜릿한 가속 추진력 부여 & 스파크 발생)
    if (obstacles.boostPads) {
      for (const pad of obstacles.boostPads) {
        if (ball.x >= pad.x && ball.x <= pad.x + pad.w &&
            ball.y >= pad.y - 8 && ball.y <= pad.y + pad.h + 8) {
          ball.vx += pad.dirX * pad.boost;
          ball.vy += pad.dirY * pad.boost;
          if (Math.random() < 0.25) {
            sounds.playBooster();
            createHitParticles(ball.x, ball.y, '#10b981');
          }
        }
      }
    }

    // 1. 공과 원형 범퍼 충돌 (위로도 튕겨 선두를 견제하고 후발주자의 역전 기회 제공!)
    for (const b of obstacles.bumpers) {
      const dx = ball.x - b.x;
      const dy = ball.y - b.y;
      const dist = Math.hypot(dx, dy);
      const minDist = ball.radius + b.radius;

      if (dist < minDist && dist > 0.001) {
        const nx = dx / dist;
        const ny = dy / dist;

        // 침투 해결: 겹치지 않도록 밀어냄
        ball.x = b.x + nx * minDist;
        ball.y = b.y + ny * minDist;

        // 반사 속도 계산
        const dot = ball.vx * nx + ball.vy * ny;
        if (dot < 0) {
          // 선두(1등) 공은 범퍼에 더 강하게 튕겨나가 후발주자에게 역전 기회 제공!
          const bounceRestitution = ball.isLeader ? 1.42 : 1.32;
          ball.vx = (ball.vx - 2 * dot * nx) * bounceRestitution;
          ball.vy = (ball.vy - 2 * dot * ny) * bounceRestitution;

          // 다이나믹 랜덤 킥 (누가 이길지 끝까지 예측할 수 없게 만듦)
          ball.vx += (Math.random() - 0.5) * 2.4;
          ball.vy += (Math.random() - 0.5) * 1.8;

          b.onHit();
          createHitParticles(ball.x, ball.y, b.color);
        }
      }
    }

    // 2. 공과 회전 스피너 충돌
    for (const spinner of obstacles.spinners) {
      // 스피너 중심축 끼임 방지: 중심축 근처에 오면 강제로 튕겨냄
      const centerDist = Math.hypot(ball.x - spinner.x, ball.y - spinner.y);
      if (centerDist < spinner.bladeWidth + ball.radius + 8) {
        ball.vy += 3.5;
        ball.vx += (ball.x >= spinner.x ? 3.0 : -3.0);
      }

      for (let i = 0; i < spinner.blades; i++) {
        const bladeAng = spinner.angle + (i * Math.PI * 2) / spinner.blades;
        const bladeCos = Math.cos(bladeAng);
        const bladeSin = Math.sin(bladeAng);

        const x1 = spinner.x;
        const y1 = spinner.y;
        const x2 = spinner.x + bladeCos * spinner.bladeLength;
        const y2 = spinner.y + bladeSin * spinner.bladeLength;

        // 공 중심에서 블레이드 선분까지의 최근접점 계산
        const p = closestPointOnSegment(ball.x, ball.y, x1, y1, x2, y2);
        const cdx = ball.x - p.x;
        const cdy = ball.y - p.y;
        const cdist = Math.hypot(cdx, cdy);
        const minThresh = ball.radius + spinner.bladeWidth / 2;

        if (cdist < minThresh && cdist > 0.0001) {
          const nx = cdx / cdist;
          const ny = cdy / cdist;

          ball.x = p.x + nx * minThresh;
          ball.y = p.y + ny * minThresh;

          // 블레이드 회전 속도 반영 + 아래쪽 전진 추진력 (위로 치솟는 무한 루프 100% 차단)
          const armDist = Math.hypot(p.x - spinner.x, p.y - spinner.y);
          const tangentialSpeed = spinner.speed * armDist;
          const tvx = -bladeSin * tangentialSpeed;
          const tvy = bladeCos * tangentialSpeed;

          ball.vx = (ball.vx * 0.4 + tvx * 1.4) + nx * 2.2;
          // 항상 최소 1.5 이상의 아래쪽 전진 속도 보장
          ball.vy = Math.max(1.5, (ball.vy * 0.3 + Math.abs(tvy) * 1.4) + ny * 1.8 + 1.2);

          sounds.playBounce(1.2);
          createHitParticles(ball.x, ball.y, '#38bdf8');
        }
      }
    }

    // 3. 공과 경사로(Ramp) 충돌
    for (const ramp of obstacles.ramps) {
      const p = closestPointOnSegment(ball.x, ball.y, ramp.x1, ramp.y1, ramp.x2, ramp.y2);
      const dx = ball.x - p.x;
      const dy = ball.y - p.y;
      const dist = Math.hypot(dx, dy);
      const minThresh = ball.radius + 3.5;

      if (dist < minThresh && dist > 0.0001) {
        const nx = dx / dist;
        const ny = dy / dist;

        ball.x = p.x + nx * minThresh;
        ball.y = p.y + ny * minThresh;

        const dot = ball.vx * nx + ball.vy * ny;
        if (dot < 0) {
          ball.vx = (ball.vx - 1.8 * dot * nx) * 0.85;
          ball.vy = (ball.vy - 1.8 * dot * ny) * 0.85;

          // 경사면 아래 방향으로 미끄럼 가속 (경사로에 멈춰있지 않도록 보장)
          let rx = ramp.x2 - ramp.x1;
          let ry = ramp.y2 - ramp.y1;
          if (ry < 0) { rx = -rx; ry = -ry; }
          const rlen = Math.hypot(rx, ry);
          if (rlen > 0) {
            rx /= rlen;
            ry /= rlen;
            ball.vx += rx * 1.5;
            ball.vy += ry * 1.5;
          }

          sounds.playBounce(0.8);
        }
      }
    }
  }

  // 4. 공과 공 사이의 충돌 (완전 탄성 구체 충돌)
  const n = balls.length;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const b1 = balls[i];
      const b2 = balls[j];

      const dx = b2.x - b1.x;
      const dy = b2.y - b1.y;
      const dist = Math.hypot(dx, dy);
      const minDist = b1.radius + b2.radius;

      if (dist < minDist && dist > 0.001) {
        const nx = dx / dist;
        const ny = dy / dist;

        // 겹침 밀어내기
        const overlap = 0.5 * (minDist - dist);
        b1.x -= nx * overlap;
        b1.y -= ny * overlap;
        b2.x += nx * overlap;
        b2.y += ny * overlap;

        // 상대 속도 교환
        const kx = b1.vx - b2.vx;
        const ky = b1.vy - b2.vy;
        const p = 2 * (nx * kx + ny * ky) / 2;

        if (p > 0) {
          b1.vx -= p * nx * 0.92;
          b1.vy -= p * ny * 0.92;
          b2.vx += p * nx * 0.92;
          b2.vy += p * ny * 0.92;

          // 살짝의 랜덤 반발력으로 역전 촉진
          const kick = (Math.random() - 0.5) * 1.6;
          b1.vx += kick;
          b2.vx -= kick;

          sounds.playBounce(0.5);
        }
      }
    }
  }
}

function closestPointOnSegment(px, py, x1, y1, x2, y2) {
  const segX = x2 - x1;
  const segY = y2 - y1;
  const lenSq = segX * segX + segY * segY;
  if (lenSq === 0) return { x: x1, y: y1 };

  let t = ((px - x1) * segX + (py - y1) * segY) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return {
    x: x1 + t * segX,
    y: y1 + t * segY
  };
}

function createHitParticles(x, y, color) {
  for (let i = 0; i < 4; i++) {
    state.particles.push(new SparkParticle(x, y, color));
  }
}

// --- 8. 결승선(Finish Line) 판정 및 게임 완료 ---
const FINISH_LINE_Y = 800; // 결승선 Y 좌표

function checkFinishLine() {
  for (const ball of state.balls) {
    if (!ball.finished && ball.y + ball.radius >= FINISH_LINE_Y) {
      ball.finished = true;
      ball.finishTime = performance.now() - state.raceStartTime;
      state.finishedBalls.push(ball);
      ball.rank = state.finishedBalls.length;

      // 1등 도착 순간 (당번 결정 순간!)
      if (ball.rank === 1) {
        sounds.playCheer();
        triggerFinishFlash();
      } else {
        sounds.playBounce(1.5);
      }

      updateLiveRankings();
    }
  }

  // 모든 공이 결승선을 통과했는지 확인
  if (state.balls.length > 0 && state.finishedBalls.length === state.balls.length && state.gameState === 'RACING') {
    endRace();
  }
}

function triggerFinishFlash() {
  // 캔버스 반짝임 효과
  const wrapper = elements.canvasWrapper;
  wrapper.style.boxShadow = '0 0 35px rgba(244, 63, 94, 0.9)';
  setTimeout(() => {
    wrapper.style.boxShadow = '';
  }, 400);
}

function endRace() {
  state.gameState = 'FINISHED';
  updateStatusBadge('완주 완료!', 'finished');
  elements.pauseBtn.disabled = true;
  elements.restartBtn.disabled = false;
  elements.startBtn.disabled = false;

  sounds.playFanfare();
  showWinnerModal();
}

// --- 9. 경기장 캔버스 렌더링 루프 ---
function drawStadium() {
  ctx.clearRect(0, 0, 600, 880);

  // 1. 경기장 배경
  const bgGrad = ctx.createLinearGradient(0, 0, 0, 880);
  bgGrad.addColorStop(0, '#131326');
  bgGrad.addColorStop(0.5, '#1e1b4b');
  bgGrad.addColorStop(1, '#0f172a');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, 600, 880);

  // 배경 네온 격자 패턴
  ctx.save();
  ctx.strokeStyle = 'rgba(99, 102, 241, 0.07)';
  ctx.lineWidth = 1;
  for (let x = 30; x < 600; x += 30) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 880);
    ctx.stroke();
  }
  for (let y = 30; y < 880; y += 30) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(600, y);
    ctx.stroke();
  }
  ctx.restore();

  // 2. 출발선 영역 (Y: 0 ~ 90)
  ctx.save();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
  ctx.fillRect(0, 0, 600, 85);
  ctx.strokeStyle = '#4f46e5';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, 85);
  ctx.lineTo(600, 85);
  ctx.stroke();

  // START 텍스트
  ctx.font = 'bold 16px Jua, sans-serif';
  ctx.fillStyle = '#818cf8';
  ctx.textAlign = 'center';
  ctx.fillText('🏁 STARTING ZONE (출발 게이트) 🏁', 300, 32);
  ctx.restore();

  // 3. 장애물 그리기
  if (state.obstacles) {
    if (state.obstacles.boostPads) {
      state.obstacles.boostPads.forEach(pad => pad.draw(ctx));
    }
    state.obstacles.ramps.forEach(ramp => ramp.draw(ctx));
    state.obstacles.bumpers.forEach(bumper => bumper.draw(ctx));
    state.obstacles.spinners.forEach(spinner => spinner.draw(ctx));
  }

  // 4. 결승선 (FINISH LINE) 체크무늬 배너 & 광선
  ctx.save();
  // 레이저 센서 빔
  ctx.shadowColor = '#f43f5e';
  ctx.shadowBlur = 12;
  ctx.strokeStyle = '#fb7185';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(0, FINISH_LINE_Y);
  ctx.lineTo(600, FINISH_LINE_Y);
  ctx.stroke();
  ctx.shadowBlur = 0;

  // 체크무늬 배너
  const checkSize = 12;
  for (let x = 0; x < 600; x += checkSize) {
    const isBlack = (Math.floor(x / checkSize) % 2 === 0);
    ctx.fillStyle = isBlack ? '#ffffff' : '#0f172a';
    ctx.fillRect(x, FINISH_LINE_Y - checkSize, checkSize, checkSize);
    ctx.fillStyle = !isBlack ? '#ffffff' : '#0f172a';
    ctx.fillRect(x, FINISH_LINE_Y, checkSize, checkSize);
  }

  // FINISH 문구
  ctx.font = 'bold 15px Jua, sans-serif';
  ctx.fillStyle = '#fef08a';
  ctx.textAlign = 'center';
  ctx.fillText('🏆 결승선 (FINISH LINE) 🏆', 300, FINISH_LINE_Y + 28);
  ctx.restore();

  // 5. 완주자 대기구역 바닥 가이드
  ctx.save();
  ctx.fillStyle = 'rgba(16, 185, 129, 0.1)';
  ctx.fillRect(0, FINISH_LINE_Y + 36, 600, 880 - (FINISH_LINE_Y + 36));
  ctx.restore();

  // 6. 충돌 파티클 그리기
  state.particles = state.particles.filter(p => p.life > 0);
  state.particles.forEach(p => {
    p.update(state.timeScale);
    p.draw(ctx);
  });

  // 7. 캐릭터 공들 그리기 (완주 안 된 공은 Y가 낮은 공부터 그려 입체감 부여)
  const sortedBalls = [...state.balls].sort((a, b) => a.y - b.y);
  sortedBalls.forEach(ball => {
    ball.draw(ctx);
  });
}

function gameLoop() {
  if (state.gameState === 'RACING') {
    const dt = state.timeScale;
    const gravity = 0.075; // 묵직하고 박진감 넘치는 롤링 중력 (약 25~35초간 긴장감 있는 레이스 연출)
    const bounds = { left: 16, right: 584, bottom: 865 };

    // 장애물 상태 갱신
    if (state.obstacles.boostPads) {
      state.obstacles.boostPads.forEach(pad => pad.update(dt));
    }
    state.obstacles.spinners.forEach(s => s.update(dt));
    state.obstacles.bumpers.forEach(b => b.update(dt));

    // 공 물리 갱신
    state.balls.forEach(ball => ball.update(dt, gravity, bounds));

    // 물리 충돌 계산
    resolveCollisions(state.balls, state.obstacles);

    // 결승선 통과 판정
    checkFinishLine();

    // 실시간 순위 리스트 업데이트 (레이스 중 Y좌표 기준)
    updateLiveRankings();
  }

  drawStadium();
  state.animationId = requestAnimationFrame(gameLoop);
}

// --- 10. 실시간 순위 계산 및 UI 갱신 ---
function updateLiveRankings() {
  const container = elements.liveRankList;
  container.innerHTML = '';

  if (state.participants.length === 0) {
    container.innerHTML = '<li class="live-rank-item" style="color:var(--text-muted); justify-content:center;">참여자가 없습니다.</li>';
    return;
  }

  // 완주된 공은 순위 순, 아직 레이스 중인 공은 Y 좌표(아래쪽일수록 결승선에 가까움) 순으로 정렬
  const ranked = [...state.balls].sort((a, b) => {
    if (a.finished && b.finished) return a.rank - b.rank;
    if (a.finished) return -1;
    if (b.finished) return 1;
    return b.y - a.y; // Y가 클수록 아래쪽 선두
  });

  // 모든 공의 선두 플래그 초기화 후 현재 1등에게 부여
  state.balls.forEach(b => b.isLeader = false);
  if (ranked.length > 0 && !ranked[0].finished) {
    ranked[0].isLeader = true;
  }

  ranked.forEach((ball, idx) => {
    const currentRank = idx + 1;
    const li = document.createElement('li');
    li.className = 'live-rank-item' + (currentRank === 1 ? ' leader' : '') + (ball.finished ? ' finished' : '');

    let rankMedal = `${currentRank}등`;
    if (currentRank === 1) rankMedal = '🥇 1등';
    else if (currentRank === 2) rankMedal = '🥈 2등';
    else if (currentRank === 3) rankMedal = '🥉 3등';

    let statusText = '';
    if (ball.finished) {
      statusText = `<span class="rank-item-status finished-tag">${ball.rank === 1 ? '👑 당번 확정!' : '완주'}</span>`;
    } else if (state.gameState === 'RACING') {
      statusText = `<span class="rank-item-status">질주 중</span>`;
    } else {
      statusText = `<span class="rank-item-status">대기</span>`;
    }

    li.innerHTML = `
      <div class="rank-item-left">
        <span class="rank-item-num">${rankMedal}</span>
        <div class="ball-avatar" style="background:${ball.palette.primary};">
          ${getAccessoryEmoji(ball.accessory)}
        </div>
        <span class="participant-name">${escapeHtml(ball.name)}</span>
      </div>
      ${statusText}
    `;
    container.appendChild(li);
  });
}

function getAccessoryEmoji(accIndex) {
  const emojis = ['🐱', '🐻', '🌱', '⭐', '🎀', '👑', '👓', '🎧', '🌸'];
  return emojis[accIndex % emojis.length];
}

// --- 11. 게임 시작, 카운트다운, 재시작 제어 ---
function startCountdown() {
  if (state.participants.length < 2) {
    showInputError('게임을 시작하려면 최소 2명 이상의 친구가 필요해요!');
    return;
  }

  // 기존 진행 중인 상태 정리
  if (state.countdownTimer) clearInterval(state.countdownTimer);

  state.gameState = 'COUNTDOWN';
  updateStatusBadge('카운트다운 중...', 'racing');
  toggleParticipantControls(false); // 참여자 입력 비활성화
  elements.startBtn.disabled = true;
  elements.pauseBtn.disabled = true;
  elements.restartBtn.disabled = true;
  if (elements.guideOverlay) elements.guideOverlay.classList.add('hidden');

  // 경기장 및 공 초기화
  setupRaceField();

  // 3, 2, 1 카운트다운 시작
  state.countdownNumber = 3;
  elements.countdownOverlay.classList.remove('hidden');
  elements.countdownText.textContent = state.countdownNumber;
  sounds.playBeep(440, 'triangle', 0.2);

  state.countdownTimer = setInterval(() => {
    state.countdownNumber--;
    if (state.countdownNumber > 0) {
      elements.countdownText.textContent = state.countdownNumber;
      sounds.playBeep(440, 'triangle', 0.2);
    } else if (state.countdownNumber === 0) {
      elements.countdownText.textContent = 'GO! 🚀';
      sounds.playBeep(880, 'sine', 0.35, 0.25);
    } else {
      clearInterval(state.countdownTimer);
      state.countdownTimer = null;
      elements.countdownOverlay.classList.add('hidden');
      launchRace();
    }
  }, 950);
}

function setupRaceField() {
  // 새 장애물 생성 (매 경기마다 예측 불가능한 4티어 슬라롬 & 핀볼 코스 구성)
  state.obstacles = generateObstacles();
  state.finishedBalls = [];
  state.particles = [];

  // 출발 레인 무작위 셔플 (특정 슬롯의 기하학적 유불리를 완전히 없애고 공정하고 예측불허의 승부 보장!)
  const shuffledParticipants = [...state.participants].sort(() => Math.random() - 0.5);
  const count = shuffledParticipants.length;
  const usableWidth = 500;
  const startY = 50;
  const gap = count > 1 ? usableWidth / (count - 1) : usableWidth;

  state.balls = shuffledParticipants.map((p, idx) => {
    const startX = 50 + (count === 1 ? usableWidth / 2 : idx * gap) + (Math.random() - 0.5) * 12;
    // 위아래 지그재그 배치로 출발 직후 엉킴 방지 및 역동적 스타트
    const jitterY = (idx % 2 === 0 ? 0 : 15) + (Math.random() - 0.5) * 8;
    return new Ball(p.id, p.name, p.palette, p.faceType, p.accessory, startX, startY + jitterY);
  });
}

function launchRace() {
  state.gameState = 'RACING';
  state.raceStartTime = performance.now();
  updateStatusBadge('레이스 질주 중!', 'racing');

  elements.pauseBtn.disabled = false;
  elements.restartBtn.disabled = false;

  // 공들에게 부드러운 출발 탄력 부여
  state.balls.forEach(ball => {
    ball.vx = (Math.random() - 0.5) * 2;
    ball.vy = 1.8 + Math.random() * 1.4;
  });
}

function togglePause() {
  if (state.gameState === 'RACING') {
    state.gameState = 'PAUSED';
    updateStatusBadge('일시정지됨', 'paused');
    elements.pauseIcon.textContent = '▶️';
    elements.pauseBtn.innerHTML = '<span>▶️</span> 계속하기';
  } else if (state.gameState === 'PAUSED') {
    state.gameState = 'RACING';
    updateStatusBadge('레이스 질주 중!', 'racing');
    elements.pauseIcon.textContent = '⏸️';
    elements.pauseBtn.innerHTML = '<span>⏸️</span> 일시정지';
  }
}

function restartRace() {
  if (state.participants.length < 2) return;
  // 모달 닫기
  hideWinnerModal();
  // 카운트다운 재시작
  startCountdown();
}

// --- 12. 우승자 및 당번 발표 모달 & 콘페티 시스템 ---
let confettiAnimationId = null;

function showWinnerModal() {
  if (state.finishedBalls.length === 0) return;
  const winner = state.finishedBalls[0];

  elements.winnerNameDisplay.textContent = winner.name;
  elements.winnerBallPreview.style.background = `radial-gradient(circle at 35% 35%, ${winner.palette.secondary}, ${winner.palette.primary} 70%, ${winner.palette.shadow})`;
  elements.winnerBallPreview.innerHTML = `
    <span style="position:absolute; top:-26px; font-size:2rem;">👑</span>
    <span style="font-size:2.4rem;">${getAccessoryEmoji(winner.accessory)}</span>
  `;

  // 최종 순위표 채우기
  const tbody = elements.finalRankingBody;
  tbody.innerHTML = '';

  state.finishedBalls.forEach((ball, idx) => {
    const rank = idx + 1;
    const tr = document.createElement('tr');
    if (rank === 1) tr.className = 'winner-row';

    const timeSec = (ball.finishTime / 1000).toFixed(2);
    let rankText = `${rank}등`;
    let noteBadge = '-';

    if (rank === 1) {
      rankText = '🥇 1등';
      noteBadge = '<span class="duty-tag-cell">👑 오늘의 당번!</span>';
    } else if (rank === 2) {
      rankText = '🥈 2등';
    } else if (rank === 3) {
      rankText = '🥉 3등';
    }

    tr.innerHTML = `
      <td><strong>${rankText}</strong></td>
      <td>
        <span class="ball-avatar" style="background:${ball.palette.primary}; margin:0 auto; width:26px; height:26px; font-size:0.8rem;">
          ${getAccessoryEmoji(ball.accessory)}
        </span>
      </td>
      <td><strong>${escapeHtml(ball.name)}</strong></td>
      <td>${timeSec}초</td>
      <td>${noteBadge}</td>
    `;
    tbody.appendChild(tr);
  });

  elements.winnerModal.classList.remove('hidden');
  startConfetti();
}

function hideWinnerModal() {
  elements.winnerModal.classList.add('hidden');
  stopConfetti();
}

// 화려한 꽃가루 (Confetti) 파티클 시스템
function startConfetti() {
  stopConfetti();
  const cCanvas = elements.confettiCanvas;
  cCanvas.width = cCanvas.clientWidth || 500;
  cCanvas.height = cCanvas.clientHeight || 500;

  const confettiColors = ['#f43f5e', '#ec4899', '#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#fbbf24'];
  state.confettiList = [];

  for (let i = 0; i < 110; i++) {
    state.confettiList.push({
      x: Math.random() * cCanvas.width,
      y: Math.random() * -cCanvas.height,
      w: 8 + Math.random() * 8,
      h: 5 + Math.random() * 5,
      color: confettiColors[Math.floor(Math.random() * confettiColors.length)],
      vx: (Math.random() - 0.5) * 3,
      vy: 2.5 + Math.random() * 4,
      rot: Math.random() * Math.PI * 2,
      vRot: (Math.random() - 0.5) * 0.2
    });
  }

  function loopConfetti() {
    confettiCtx.clearRect(0, 0, cCanvas.width, cCanvas.height);
    state.confettiList.forEach(c => {
      c.x += c.vx;
      c.y += c.vy;
      c.rot += c.vRot;

      if (c.y > cCanvas.height + 20) {
        c.y = -20;
        c.x = Math.random() * cCanvas.width;
      }

      confettiCtx.save();
      confettiCtx.translate(c.x, c.y);
      confettiCtx.rotate(c.rot);
      confettiCtx.fillStyle = c.color;
      confettiCtx.fillRect(-c.w / 2, -c.h / 2, c.w, c.h);
      confettiCtx.restore();
    });

    confettiAnimationId = requestAnimationFrame(loopConfetti);
  }

  loopConfetti();
}

function stopConfetti() {
  if (confettiAnimationId) {
    cancelAnimationFrame(confettiAnimationId);
    confettiAnimationId = null;
  }
  confettiCtx.clearRect(0, 0, elements.confettiCanvas.width, elements.confettiCanvas.height);
}

// --- 13. 참여자 관리 (추가, 삭제, 섞기, 초기화) ---
function addParticipant(name) {
  const trimmed = name.trim();
  showInputError('');

  if (!trimmed) {
    showInputError('친구의 이름을 입력해 주세요!');
    elements.nameInput.focus();
    return false;
  }

  if (state.participants.some(p => p.name.toLowerCase() === trimmed.toLowerCase())) {
    showInputError(`'${trimmed}'(은)는 이미 등록된 이름입니다.`);
    elements.nameInput.focus();
    return false;
  }

  const palette = BALL_PALETTES[state.nextColorIndex % BALL_PALETTES.length];
  state.nextColorIndex++;

  const newParticipant = {
    id: Date.now() + Math.random().toString(36).substring(2, 7),
    name: trimmed,
    palette: palette,
    faceType: Math.floor(Math.random() * 6),
    accessory: Math.floor(Math.random() * 9)
  };

  state.participants.push(newParticipant);
  renderParticipantList();
  elements.nameInput.value = '';
  elements.nameInput.focus();

  // 안내 미리보기 및 상태 업데이트
  updateGuidePreview();
  updateLiveRankings();
  checkStartEligibility();

  return true;
}

function removeParticipant(id) {
  if (state.gameState === 'RACING' || state.gameState === 'COUNTDOWN') return;
  state.participants = state.participants.filter(p => p.id !== id);
  renderParticipantList();
  updateGuidePreview();
  updateLiveRankings();
  checkStartEligibility();
}

function clearAllParticipants() {
  if (state.gameState === 'RACING' || state.gameState === 'COUNTDOWN') return;
  state.participants = [];
  state.balls = [];
  state.finishedBalls = [];
  state.nextColorIndex = 0;
  renderParticipantList();
  updateGuidePreview();
  updateLiveRankings();
  checkStartEligibility();
  elements.guideOverlay.classList.remove('hidden');
}

function shuffleParticipants() {
  if (state.gameState === 'RACING' || state.gameState === 'COUNTDOWN') return;
  if (state.participants.length < 2) return;

  for (let i = state.participants.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [state.participants[i], state.participants[j]] = [state.participants[j], state.participants[i]];
  }
  renderParticipantList();
  updateLiveRankings();
}

function addSampleParticipants() {
  SAMPLE_NAMES.forEach(name => {
    if (!state.participants.some(p => p.name === name)) {
      addParticipant(name);
    }
  });
}

function renderParticipantList() {
  const list = elements.participantList;
  const countBadge = elements.participantCountBadge;
  const emptyNotice = elements.emptyListNotice;

  list.innerHTML = '';
  const count = state.participants.length;
  countBadge.textContent = `${count}명 참여 중`;

  if (count === 0) {
    emptyNotice.style.display = 'block';
  } else {
    emptyNotice.style.display = 'none';
    state.participants.forEach((p, idx) => {
      const li = document.createElement('li');
      li.className = 'participant-item';
      li.innerHTML = `
        <div class="participant-info">
          <div class="ball-avatar" style="background:${p.palette.primary};">
            ${getAccessoryEmoji(p.accessory)}
          </div>
          <span class="participant-name">${escapeHtml(p.name)}</span>
        </div>
        <button type="button" class="participant-delete-btn" title="${escapeHtml(p.name)} 삭제" data-id="${p.id}">
          ❌
        </button>
      `;
      list.appendChild(li);
    });
  }

  // 삭제 버튼 이벤트 바인딩
  list.querySelectorAll('.participant-delete-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      removeParticipant(btn.getAttribute('data-id'));
    });
  });
}

function updateGuidePreview() {
  const container = elements.guidePreview;
  container.innerHTML = '';

  if (state.participants.length === 0) {
    container.innerHTML = '🎈 🎈 🎈';
    return;
  }

  const previewSlice = state.participants.slice(0, 5);
  previewSlice.forEach(p => {
    const div = document.createElement('div');
    div.className = 'ball-avatar';
    div.style.background = p.palette.primary;
    div.style.width = '42px';
    div.style.height = '42px';
    div.style.fontSize = '1.3rem';
    div.innerHTML = getAccessoryEmoji(p.accessory);
    container.appendChild(div);
  });
}

function checkStartEligibility() {
  const count = state.participants.length;
  if (count >= 2) {
    elements.startBtn.disabled = false;
  } else {
    elements.startBtn.disabled = true;
  }
}

function toggleParticipantControls(enabled) {
  elements.nameInput.disabled = !enabled;
  elements.addBtn.disabled = !enabled;
  elements.quickSampleBtn.disabled = !enabled;
  elements.shuffleBtn.disabled = !enabled;
  elements.clearAllBtn.disabled = !enabled;

  const deleteBtns = elements.participantList.querySelectorAll('.participant-delete-btn');
  deleteBtns.forEach(btn => btn.disabled = !enabled);
}

function showInputError(msg) {
  elements.inputErrorMsg.textContent = msg;
}

function updateStatusBadge(text, className) {
  elements.raceStatusBadge.textContent = text;
  elements.raceStatusBadge.className = `status-badge ${className}`;
}

function escapeHtml(str) {
  return str.replace(/[&<>'"]/g, tag => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  }[tag] || tag));
}

// --- 14. 이벤트 리스너 등록 ---
function setupEventListeners() {
  // 1. 이름 추가
  elements.addBtn.addEventListener('click', () => {
    sounds.init();
    addParticipant(elements.nameInput.value);
  });

  elements.nameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      sounds.init();
      addParticipant(elements.nameInput.value);
    }
  });

  // 2. 퀵 액션 버튼
  elements.quickSampleBtn.addEventListener('click', () => {
    sounds.init();
    addSampleParticipants();
  });

  elements.shuffleBtn.addEventListener('click', () => {
    sounds.init();
    shuffleParticipants();
  });

  elements.clearAllBtn.addEventListener('click', () => {
    sounds.init();
    if (confirm('등록된 모든 친구를 목록에서 삭제하시겠습니까?')) {
      clearAllParticipants();
    }
  });

  // 3. 게임 제어 버튼
  elements.startBtn.addEventListener('click', () => {
    sounds.init();
    startCountdown();
  });

  elements.pauseBtn.addEventListener('click', () => {
    sounds.init();
    togglePause();
  });

  elements.restartBtn.addEventListener('click', () => {
    sounds.init();
    restartRace();
  });

  // 4. 사운드 토글
  elements.soundToggleBtn.addEventListener('click', () => {
    const isEnabled = sounds.toggle();
    elements.soundIcon.textContent = isEnabled ? '🔊' : '🔇';
    elements.soundToggleBtn.title = isEnabled ? '효과음 끄기' : '효과음 켜기';
  });

  // 5. 레이스 속도 조절
  elements.speedBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      elements.speedBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.timeScale = parseFloat(btn.dataset.speed) || 1.0;
    });
  });

  // 6. 결과 모달 버튼
  elements.modalRestartBtn.addEventListener('click', () => {
    sounds.init();
    hideWinnerModal();
    startCountdown();
  });

  elements.modalCloseBtn.addEventListener('click', () => {
    hideWinnerModal();
    toggleParticipantControls(true); // 입력 다시 활성화
  });
}

// --- 15. 초기화 실행 ---
function initApp() {
  setupEventListeners();

  // 기본 샘플 참여자 5명 로드하여 바로 테스트 가능하도록 제공
  addSampleParticipants();

  // 초기 장애물 및 트랙 배치
  state.obstacles = generateObstacles();

  // 애니메이션 루프 시작
  state.animationId = requestAnimationFrame(gameLoop);
}

// DOM 로드 완료 후 실행
document.addEventListener('DOMContentLoaded', initApp);
