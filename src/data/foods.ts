// A built-in list of common foods with typical calories per serving.
// These are approximate, typical values: real portions and recipes vary a lot.
// The user can always change the number. Nothing here is looked up online.
export interface Food { name: string; serving: string; kcal: number; alias?: string }

export const FOODS: Food[] = [
  // Rice and noodle dishes
  { name: 'Nasi lemak (basic)', serving: '1 plate', kcal: 400, alias: '椰浆饭' },
  { name: 'Nasi lemak with fried chicken', serving: '1 plate', kcal: 650, alias: '椰浆饭 炸鸡' },
  { name: 'Chicken rice', serving: '1 plate', kcal: 600, alias: '鸡饭 海南鸡饭' },
  { name: 'Nasi goreng', serving: '1 plate', kcal: 640, alias: '炒饭 fried rice' },
  { name: 'Economy rice (rice + 3 dishes)', serving: '1 plate', kcal: 650, alias: '杂饭 经济饭 mixed rice nasi campur' },
  { name: 'Nasi kandar', serving: '1 plate', kcal: 750, alias: '扁担饭' },
  { name: 'Nasi briyani with chicken', serving: '1 plate', kcal: 800, alias: '印度香饭 biryani' },
  { name: 'White rice', serving: '1 bowl', kcal: 200, alias: '白饭 米饭 nasi putih' },
  { name: 'Brown rice', serving: '1 bowl', kcal: 215, alias: '糙米饭' },
  { name: 'Chicken porridge', serving: '1 bowl', kcal: 220, alias: '鸡粥 粥 congee bubur' },
  { name: 'Char kuey teow', serving: '1 plate', kcal: 740, alias: '炒粿条' },
  { name: 'Mee goreng', serving: '1 plate', kcal: 660, alias: '炒面 fried noodles' },
  { name: 'Hokkien mee (dark)', serving: '1 plate', kcal: 620, alias: '福建面' },
  { name: 'Wantan mee (dry)', serving: '1 plate', kcal: 410, alias: '云吞面' },
  { name: 'Pan mee', serving: '1 bowl', kcal: 480, alias: '板面' },
  { name: 'Curry laksa', serving: '1 bowl', kcal: 590, alias: '咖喱叻沙 咖喱面 curry mee' },
  { name: 'Asam laksa', serving: '1 bowl', kcal: 430, alias: '亚参叻沙' },
  { name: 'Fish ball noodle soup', serving: '1 bowl', kcal: 330, alias: '鱼丸面 鱼圆面' },
  { name: 'Mee soup', serving: '1 bowl', kcal: 380, alias: '汤面' },
  { name: 'Bak kut teh', serving: '1 bowl', kcal: 350, alias: '肉骨茶' },
  { name: 'Yong tau foo (6 pieces, soup)', serving: '1 bowl', kcal: 250, alias: '酿豆腐' },
  // Breads and Indian
  { name: 'Roti canai', serving: '1 piece', kcal: 300, alias: '印度煎饼 roti prata' },
  { name: 'Roti telur', serving: '1 piece', kcal: 360, alias: '鸡蛋煎饼' },
  { name: 'Thosai (plain)', serving: '1 piece', kcal: 130, alias: 'dosa tosai' },
  { name: 'Chapati', serving: '1 piece', kcal: 150, alias: '印度薄饼' },
  { name: 'Dhal curry', serving: '1 small bowl', kcal: 120, alias: '扁豆咖喱' },
  { name: 'Kaya toast with butter', serving: '2 slices', kcal: 230, alias: '咖椰吐司 加央' },
  { name: 'White bread', serving: '1 slice', kcal: 75, alias: '白面包' },
  { name: 'Wholemeal bread', serving: '1 slice', kcal: 70, alias: '全麦面包' },
  { name: 'Oats (cooked)', serving: '1 bowl', kcal: 150, alias: '燕麦 麦片 oatmeal' },
  // Meat, fish, eggs, vegetables
  { name: 'Fried chicken', serving: '1 piece', kcal: 250, alias: '炸鸡 ayam goreng' },
  { name: 'Roast chicken', serving: '1 piece', kcal: 200, alias: '烧鸡 烤鸡' },
  { name: 'Curry chicken', serving: '1 serving', kcal: 300, alias: '咖喱鸡' },
  { name: 'Chicken satay', serving: '1 stick', kcal: 40, alias: '沙爹' },
  { name: 'Satay peanut sauce', serving: '2 tablespoons', kcal: 80, alias: '沙爹酱 kuah kacang' },
  { name: 'Steamed fish', serving: '1 serving', kcal: 150, alias: '蒸鱼' },
  { name: 'Fried fish', serving: '1 piece', kcal: 220, alias: '炸鱼 ikan goreng' },
  { name: 'Stir-fried vegetables', serving: '1 serving', kcal: 100, alias: '炒菜 青菜 sayur' },
  { name: 'Tofu (braised)', serving: '1 serving', kcal: 120, alias: '豆腐' },
  { name: 'Boiled egg', serving: '1 egg', kcal: 70, alias: '水煮蛋 鸡蛋' },
  { name: 'Fried egg', serving: '1 egg', kcal: 90, alias: '煎蛋 荷包蛋 telur goreng' },
  { name: 'Half-boiled eggs', serving: '2 eggs', kcal: 140, alias: '生熟蛋 半熟蛋' },
  { name: 'Chicken salad', serving: '1 bowl', kcal: 300, alias: '沙拉' },
  // Dim sum and snacks
  { name: 'Siew mai', serving: '1 piece', kcal: 50, alias: '烧卖 dim sum 点心' },
  { name: 'Har gow', serving: '1 piece', kcal: 40, alias: '虾饺 dim sum 点心' },
  { name: 'Char siu bao', serving: '1 piece', kcal: 180, alias: '叉烧包 pau' },
  { name: 'Curry puff', serving: '1 piece', kcal: 200, alias: '咖喱角 karipap' },
  { name: 'Pisang goreng', serving: '1 piece', kcal: 130, alias: '炸香蕉 banana fritter' },
  { name: 'Kuih', serving: '1 piece', kcal: 100, alias: '糕点 娘惹糕' },
  { name: 'Cream crackers', serving: '3 pieces', kcal: 100, alias: '苏打饼 biscuit' },
  { name: 'Peanuts', serving: '1 small handful', kcal: 170, alias: '花生 kacang' },
  { name: 'Yogurt', serving: '1 cup', kcal: 100, alias: '酸奶 优格' },
  { name: 'Cendol', serving: '1 bowl', kcal: 390, alias: '煎蕊' },
  { name: 'Ais kacang', serving: '1 bowl', kcal: 260, alias: '红豆冰 ABC' },
  // Western
  { name: 'Chicken burger', serving: '1 burger', kcal: 450, alias: '汉堡' },
  { name: 'Pizza', serving: '1 slice', kcal: 270, alias: '披萨' },
  { name: 'French fries', serving: '1 medium', kcal: 340, alias: '薯条' },
  { name: 'Spaghetti bolognese', serving: '1 plate', kcal: 550, alias: '意大利面' },
  // Fruit
  { name: 'Banana', serving: '1 medium', kcal: 105, alias: '香蕉 pisang' },
  { name: 'Apple', serving: '1 medium', kcal: 95, alias: '苹果' },
  { name: 'Orange', serving: '1 medium', kcal: 60, alias: '橙 橘子' },
  { name: 'Papaya', serving: '1 slice', kcal: 60, alias: '木瓜 betik' },
  { name: 'Watermelon', serving: '1 slice', kcal: 50, alias: '西瓜 tembikai' },
  { name: 'Mango', serving: '1/2 fruit', kcal: 100, alias: '芒果 mangga' },
  { name: 'Guava', serving: '1/2 fruit', kcal: 60, alias: '番石榴 芭乐 jambu' },
  // Drinks
  { name: 'Teh tarik', serving: '1 glass', kcal: 130, alias: '拉茶' },
  { name: 'Teh O (sweet)', serving: '1 glass', kcal: 60, alias: '茶乌' },
  { name: 'Kopi (with condensed milk)', serving: '1 cup', kcal: 110, alias: '咖啡' },
  { name: 'Kopi O (sweet)', serving: '1 cup', kcal: 60, alias: '咖啡乌' },
  { name: 'Kopi O kosong / Teh O kosong', serving: '1 cup', kcal: 5, alias: '无糖 咖啡乌 茶乌' },
  { name: 'Milo', serving: '1 cup', kcal: 130, alias: '美禄' },
  { name: 'Full cream milk', serving: '1 glass', kcal: 150, alias: '牛奶 susu' },
  { name: 'Soy milk (sweetened)', serving: '1 glass', kcal: 130, alias: '豆浆 豆奶' },
  { name: 'Fruit juice', serving: '1 glass', kcal: 110, alias: '果汁 jus' },
  { name: 'Coconut water', serving: '1 glass', kcal: 45, alias: '椰子水 air kelapa' },
  { name: 'Soft drink', serving: '1 can', kcal: 140, alias: '汽水' },
  { name: 'Isotonic drink', serving: '1 can', kcal: 80, alias: '100plus 运动饮料' },
  { name: 'Bubble milk tea', serving: '1 cup', kcal: 350, alias: '珍珠奶茶 boba' },
]

/** Foods whose name or alias contains the text. Substring match, so Chinese works. */
export function searchFoods(text: string, limit = 8): Food[] {
  const q = text.trim().toLowerCase()
  if (!q) return []
  return FOODS.filter((f) => f.name.toLowerCase().includes(q) || (f.alias ?? '').toLowerCase().includes(q)).slice(0, limit)
}
