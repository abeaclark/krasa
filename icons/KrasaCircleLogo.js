import React from 'react'
import Icon from 'react-icon-base'

const FaCaretLeft = props => (
    <Icon viewBox="5 5 120 120" {...props}>
      <circle cx="60" cy="60" r="50" stroke={props.color || 'black'} strokeWidth="8" fill="rgba(0,0,0,0)" />
      <line x1="42.5" y1="30" x2="42.5" y2="85" stroke={props.color || 'black'} strokeWidth="8" />
      <path d="M82.5 30 l-27.5 27.5 l27.5 27.5" fill="transparent" stroke={props.color || 'black'} strokeWidth="8"/>
    </Icon>
)

export default FaCaretLeft