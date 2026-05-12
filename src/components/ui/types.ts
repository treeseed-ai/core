export type Tone = 'default' | 'muted' | 'accent' | 'info' | 'success' | 'warning' | 'danger';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

export type ButtonSize = 'sm' | 'md';

export type ButtonAction = {
	label: string;
	href?: string;
	type?: 'button' | 'submit' | 'reset';
	variant?: ButtonVariant;
	ariaLabel?: string;
	disabled?: boolean;
};
