type FaceFighterPreviewProps = {
  imageUrl: string
  label?: string
}

/** 2D in-game portrait preview — same comic frame style as the HTML prototype. */
export function FaceFighterPreview({
  imageUrl,
  label = 'ĐỐI THỦ',
}: FaceFighterPreviewProps) {
  return (
    <div className="ff-preview">
      <div className="ff-ring" aria-hidden />
      <div className="ff-hud">
        <div
          className="ff-portrait"
          style={{ backgroundImage: `url(${imageUrl})` }}
          role="img"
          aria-label="Mặt đối thủ trong game"
        />
        <div className="ff-hp-shell">
          <div className="ff-name">{label}</div>
          <div className="ff-hp-bar">
            <div className="ff-hp-fill" />
          </div>
        </div>
      </div>
      <p className="ff-caption">Texture dùng trong game — giống khung HUD gốc</p>
    </div>
  )
}
