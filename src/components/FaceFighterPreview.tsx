type FaceFighterPreviewProps = {
  imageUrl: string
  label?: string
}

/** 2D in-game portrait preview — Bauhaus HUD frame. */
export function FaceFighterPreview({
  imageUrl,
  label = 'OPPONENT',
}: FaceFighterPreviewProps) {
  return (
    <div className="ff-preview">
      <div className="ff-ring" aria-hidden />
      <div className="ff-hud">
        <div
          className="ff-portrait"
          style={{ backgroundImage: `url(${imageUrl})` }}
          role="img"
          aria-label="Opponent face in game"
        />
        <div className="ff-hp-shell">
          <div className="ff-name">{label}</div>
          <div className="ff-hp-bar">
            <div className="ff-hp-fill" />
          </div>
        </div>
      </div>
      <p className="ff-caption">In-game texture — matches the fight HUD</p>
    </div>
  )
}
