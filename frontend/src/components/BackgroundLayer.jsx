function ShootingStar({ style }) {
  return (
    <div
      className="shooting-star"
      style={style}
    />
  )
}

const stars = [
  { top: '8%',  left: '90%', delay: '0s',    duration: '2.4s', length: 160 },
  { top: '15%', left: '75%', delay: '1.2s',  duration: '2.8s', length: 130 },
  { top: '5%',  left: '60%', delay: '2.6s',  duration: '2.2s', length: 190 },
  { top: '25%', left: '85%', delay: '0.7s',  duration: '3.1s', length: 110 },
  { top: '35%', left: '70%', delay: '3.4s',  duration: '2.5s', length: 150 },
  { top: '10%', left: '45%', delay: '1.9s',  duration: '2.9s', length: 120 },
  { top: '50%', left: '95%', delay: '0.4s',  duration: '2.3s', length: 170 },
  { top: '20%', left: '30%', delay: '2.1s',  duration: '3.3s', length: 100 },
  { top: '60%', left: '80%', delay: '1.5s',  duration: '2.6s', length: 140 },
  { top: '40%', left: '55%', delay: '3.8s',  duration: '2.1s', length: 180 },
  { top: '70%', left: '65%', delay: '0.9s',  duration: '2.7s', length: 125 },
  { top: '12%', left: '20%', delay: '4.2s',  duration: '3.0s', length: 115 },
  { top: '80%', left: '90%', delay: '1.7s',  duration: '2.4s', length: 155 },
  { top: '45%', left: '10%', delay: '3.0s',  duration: '2.8s', length: 135 },
  { top: '30%', left: '40%', delay: '2.4s',  duration: '3.2s', length: 145 },
]

import { useTheme } from '../context/ThemeContext'

export default function BackgroundLayer() {
  const { dark } = useTheme()
  if (dark) {
    return (
      <div className="bg-layer bg-layer--dark" aria-hidden="true" />
    )
  }

  return (
    <div className="bg-layer bg-layer--light" aria-hidden="true">
      {stars.map((s, i) => (
        <ShootingStar
          key={i}
          style={{
            top: s.top,
            left: s.left,
            width: `${s.length}px`,
            animationDelay: s.delay,
            animationDuration: s.duration,
          }}
        />
      ))}
    </div>
  )
}
