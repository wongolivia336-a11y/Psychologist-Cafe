import Link from "next/link";
import { NOTICE_POINTS, NOTICE_TITLE } from "@/lib/notice";

export default function NoticePage() {
  return (
    <main className="notice-shell">
      <article className="notice-card">
        <Link href="/" className="quiet-link">← 回到大厅</Link>
        <div className="scene-kicker">Informed presence</div>
        <h1>{NOTICE_TITLE}</h1>
        <div className="notice-card__copy">
          {NOTICE_POINTS.map((point) => <p key={point}>{point}</p>)}
        </div>
        <p className="notice-card__closing">确认只保存在当前浏览器标签页的会话里，关闭标签页后消失。</p>
        <Link href="/" className="notice-card__back">我已阅读，回到大厅</Link>
      </article>
    </main>
  );
}
