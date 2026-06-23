import { useNavigate } from 'react-router-dom';

type BackButtonProps = {
  to?: string;
  label?: string;
};

export default function BackButton({
  to,
  label = 'Retour',
}: BackButtonProps) {
  const navigate = useNavigate();

  const handleClick = () => {
    if (to) {
      navigate(to);
      return;
    }

    navigate(-1);
  };

  return (
    <button type="button" className="backButton" onClick={handleClick}>
      <span aria-hidden="true">←</span>
      <span>{label}</span>
    </button>
  );
}
