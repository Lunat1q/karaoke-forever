import React from 'react'
import { useSwipeable } from 'react-swipeable'

interface SwipeableProps {
  onSwipedLeft?: (eventData: any) => void
  onSwipedRight?: (eventData: any) => void
  preventDefaultTouchmoveEvent?: boolean
  trackMouse?: boolean
  style?: React.CSSProperties
  className?: string
  children?: React.ReactNode
}

const Swipeable: React.FC<SwipeableProps> = ({
  onSwipedLeft,
  onSwipedRight,
  preventDefaultTouchmoveEvent,
  trackMouse,
  style,
  className,
  children,
}) => {
  const handlers = useSwipeable({
    onSwipedLeft,
    onSwipedRight,
    trackMouse,
  })

  return (
    <div {...handlers} style={style} className={className}>
      {children}
    </div>
  )
}

export default Swipeable
