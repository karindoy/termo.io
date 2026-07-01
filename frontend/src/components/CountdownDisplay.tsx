interface CountdownDisplayProps {
  seconds: number;
  label?: string;
}

export function CountdownDisplay({ seconds, label }: CountdownDisplayProps) {
  return (
    <div className="countdown-display">
      {label && <p className="countdown-label">{label}</p>}
      <div key={seconds} className="countdown-number">
        {seconds}
      </div>
    </div>
  );
}
