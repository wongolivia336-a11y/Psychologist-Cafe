import Link from "next/link";
import { PERSONAS } from "@/lib/personas";
import ArtDirectionControl from "@/components/ArtDirectionControl";

/**
 * 大堂是一个固定机位的夜间静物场景。
 * 桌子是入口，文字只负责给用户一条安静的方向感。
 */
export default function Lobby() {
  return (
    <main className="lobby-shell">
      <div className="cafe-room" aria-hidden="true">
        <div className="room-window" />
      </div>

      <header className="lobby-header">
        <div className="lobby-header__top">
          <div className="scene-kicker">Cold geometry · study in presence</div>
          <ArtDirectionControl />
        </div>
        <h1>在场</h1>
        <p>
          给独自吃饭的人，一顿有人在场的饭。
          <br />
          选一张亮着灯的桌子坐下。
        </p>
      </header>

      <section className="lobby-stage" aria-label="咖啡馆里的桌子">
        <div className="lobby-tables">
          {PERSONAS.map((persona) => {
            const style = {
              left: `${persona.table.x}%`,
              top: `${persona.table.y}%`,
            } as const;

            const content = (
              <>
                <span className="table-node__flame" aria-hidden="true" />
                <span className="table-node__surface" aria-hidden="true" />
                <span className="table-node__name">
                  {persona.unlocked ? persona.name : "空桌"}
                </span>
                <span className="table-node__meta">
                  {persona.unlocked ? persona.latin : "灯还没有亮起"}
                </span>
              </>
            );

            return persona.unlocked ? (
              <Link
                key={persona.id}
                href={`/table/${persona.id}`}
                style={style}
                className="table-node is-lit"
                title={persona.tagline}
              >
                {content}
              </Link>
            ) : (
              <div
                key={persona.id}
                style={style}
                className="table-node table-node--closed"
                aria-disabled="true"
                title="这张桌子的灯还没有亮起"
              >
                {content}
              </div>
            );
          })}
        </div>

        <p className="stage-caption">
          这里没有菜单，也没有需要完成的事情。
          <br />
          只要坐下来，桌子就会在这里。
        </p>
      </section>

      <footer className="lobby-footer">
        <p>
          这不是心理咨询，也不是诊疗工具。这里不记录你吃了什么，也不会统计你来过几次。
        </p>
        <p>
          <Link href="/notice" className="quiet-link">成年确认与知情说明</Link>
          <br />
          如果你正处在危险中，请联系当地的紧急支持渠道。
        </p>
      </footer>
    </main>
  );
}
