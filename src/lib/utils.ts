export const logger = (
  message: string,
  type: "info" | "error" | "warn" | "success"
) => {
  const timestamp = new Date().toLocaleString();
  switch (type) {
    case "info":
      console.log(`[${timestamp}] ${message}`);
      break;
    case "error":
      console.error(`❌ [${timestamp}] ${message}`);
      break;
    case "warn":
      console.warn(`⚠️ [${timestamp}] ${message}`);
      break;
    case "success":
      console.log(`✅ [${timestamp}] ${message}`);
      break;
  }
};

export const getAvatarUrl = (name: string) => {
  return `https://api.dicebear.com/8.x/fun-emoji/svg?seed=${name}&backgroundType=gradientLinear&mouth=cute,kissHeart,lilSmile,smileLol,smileTeeth,tongueOut,wideSmile`;
};
