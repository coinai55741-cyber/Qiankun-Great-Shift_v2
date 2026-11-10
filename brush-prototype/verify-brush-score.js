'use strict';

// 重現 app.js 的 assess() + finish() 計分（不含畫布運算），用來驗證 F1 門檻。
// 執行：node verify-brush-score.js
// strokeRatio = 辨識到的筆畫比例（covered / total），預設 1。
const BRUSH_MAX = 20;
const CHANCE_F1 = 0.25;
const ORDER_BONUS = 0.15;
const STRICT_FROM = 0.7;
const STRICT_POW = 1.5;

function assessFromF1(f1, orderRate, tangle = 0, strokeRatio = 1) {
  const skill = Math.max(0, (f1 - CHANCE_F1) / (1 - CHANCE_F1))
    * (1 - 0.8 * tangle);
  // orderRate === null 代表這個字沒有筆順資料，只看形狀分
  const raw = orderRate === null
    ? skill
    : (1 - ORDER_BONUS) * skill
      + ORDER_BONUS * orderRate * strokeRatio * Math.min(1, skill / 0.5);
  const value = raw <= STRICT_FROM
    ? raw
    : STRICT_FROM + (1 - STRICT_FROM)
      * Math.pow((raw - STRICT_FROM) / (1 - STRICT_FROM), STRICT_POW);
  return { f1, skill, raw, value };
}

function finish(f1Values, orderRate) {
  const values = f1Values.map(f1 => assessFromF1(f1, orderRate).value);
  return values.reduce((sum, value) => sum + value, 0) / 5 * BRUSH_MAX;
}

function minimumUniformF1(targetScore, orderRate) {
  let low = 0;
  let high = 1;
  for (let i = 0; i < 100; i++) {
    const mid = (low + high) / 2;
    if (finish(Array(5).fill(mid), orderRate) >= targetScore) high = mid;
    else low = mid;
  }
  return high;
}

for (const target of [15, 16, 17, 18, 19, 20]) {
  const fullOrder = minimumUniformF1(target, 1);
  const noOrder = minimumUniformF1(target, 0);
  console.log(
    `${target} 分 | 筆順全對 F1=${fullOrder.toFixed(9)}`
    + ` | 筆順全錯 F1=${noOrder.toFixed(9)}`
    + ` | 回算=${finish(Array(5).fill(fullOrder), 1).toFixed(9)}`
    + ` / ${finish(Array(5).fill(noOrder), 0).toFixed(9)}`
  );
}

// Same mean F1, different per-character distribution: demonstrates that mean
// F1 alone does not determine the final score after the nonlinear STRICT curve.
const uniform = Array(5).fill(0.8);
const varied = [0.6, 0.7, 0.8, 0.9, 1.0];
console.log('\n平均 F1 均為 0.8 的分布檢查：');
console.log(`均勻五字（筆順全對）=${finish(uniform, 1).toFixed(6)}`);
console.log(`分散五字（筆順全對）=${finish(varied, 1).toFixed(6)}`);
console.log(`均勻五字（筆順全錯）=${finish(uniform, 0).toFixed(6)}`);
console.log(`分散五字（筆順全錯）=${finish(varied, 0).toFixed(6)}`);

// 筆順全對但只辨識到部分筆畫時，加分按比例縮小
console.log('\n筆順全對、F1 0.95 時，辨識到的筆畫比例對分數的影響：');
for (const ratio of [1, 0.9, 0.8, 0.5, 0.2]) {
  const s = assessFromF1(0.95, 1, 0, ratio).value * BRUSH_MAX;
  console.log(`筆畫比例 ${ratio} → ${s.toFixed(2)} 分`);
}
