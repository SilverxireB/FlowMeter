import type { IconName } from "@/components/Icon";
import type { SlideType } from "@/lib/types";

/**
 * Slayt tipi → çekirdek ikon adı. Eskiden tipler emoji ile gösteriliyordu;
 * emoji cihazdan cihaza farklı çizildiği için tip rozetleri tutarsız
 * görünüyordu (gri küçük etiketin yanında renkli/iri glif). Sıralı görünüm:
 * her tipin BAŞKA bir siluete sahip olmasına dikkat edildi.
 */
export const SLIDE_TYPE_ICON_NAMES: Record<SlideType, IconName> = {
  "multiple-choice": "chart",
  "word-cloud": "cloud",
  "open-ended": "chat",
  scales: "star",
  ranking: "listOrdered",
  qna: "hand",
  quiz: "zap",
  "quiz-type": "pencil",
  "pin-on-image": "pin",
  "guess-number": "hash",
  "hundred-points": "target",
  "grid-2x2": "grid",
  content: "text",
  image: "image",
  video: "video",
  instructions: "list",
  leaderboard: "trophy",
};
