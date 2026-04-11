import { NotationParser } from '../src/utils/parser';

describe('NotationParser', () => {
	beforeEach(() => {
		NotationParser.clearCache();
	});

	test('parses NPC tags correctly', () => {
		const content = '[N:Jonah|friendly|wounded]';
		const result = NotationParser.parse(content);
		expect(result.npcs.has('Jonah')).toBe(true);
		expect(result.npcs.get('Jonah')?.tags).toEqual(['friendly', 'wounded']);
	});

	test('handles multiple NPC mentions and merges tags', () => {
		const content = `
			[N:Jonah|friendly]
			Some text
			[N:Jonah|wounded]
		`;
		const result = NotationParser.parse(content);
		expect(result.npcs.get('Jonah')?.tags).toContain('friendly');
		expect(result.npcs.get('Jonah')?.tags).toContain('wounded');
		expect(result.npcs.get('Jonah')?.mentions).toHaveLength(2);
	});

	test('parses location tags correctly', () => {
		const content = '[L:Lighthouse|ruined]';
		const result = NotationParser.parse(content);
		expect(result.locations.has('Lighthouse')).toBe(true);
		expect(result.locations.get('Lighthouse')?.tags).toEqual(['ruined']);
	});

	test('parses thread tags and updates state', () => {
		const content = `
			[Thread:Find Sister|Open]
			...
			[Thread:Find Sister|Closed]
		`;
		const result = NotationParser.parse(content);
		expect(result.threads.get('Find Sister')?.state).toBe('Closed');
	});

	test('parses progress elements (clocks, tracks, timers)', () => {
		const content = `
			[E:Alert 2/6]
			[Clock:Ritual 5/12]
			[Track:Investigation 4/10]
			[Timer:Dawn 3]
		`;
		const result = NotationParser.parse(content);

		const clockE = result.progress.find(p => p.type === 'clock' && p.name === 'Alert');
		expect(clockE?.name).toBe('Alert');
		expect(clockE?.current).toBe(2);
		expect(clockE?.max).toBe(6);

		const clockLiteral = result.progress.find(p => p.type === 'clock' && p.name === 'Ritual');
		expect(clockLiteral?.name).toBe('Ritual');
		expect(clockLiteral?.current).toBe(5);
		expect(clockLiteral?.max).toBe(12);

		const track = result.progress.find(p => p.type === 'track');
		expect(track?.name).toBe('Investigation');
		expect(track?.current).toBe(4);
		expect(track?.max).toBe(10);

		const timer = result.progress.find(p => p.type === 'timer');
		expect(timer?.name).toBe('Dawn');
		expect(timer?.current).toBe(3);
	});

	test('inline update syntax uses the -> value as active current', () => {
		const content = `
			[Clock:Ritual 0/6 ->2/6]
			[E:Alert 1/4 ->3/4]
			[Track:Escape 2/8 ->5/8]
			[Timer:Dawn 5 ->3]
		`;
		const result = NotationParser.parse(content);

		const ritual = result.progress.find(p => p.name === 'Ritual');
		expect(ritual?.current).toBe(2);
		expect(ritual?.max).toBe(6);

		const alert = result.progress.find(p => p.name === 'Alert');
		expect(alert?.current).toBe(3);
		expect(alert?.max).toBe(4);

		const escape = result.progress.find(p => p.name === 'Escape');
		expect(escape?.current).toBe(5);
		expect(escape?.max).toBe(8);

		const dawn = result.progress.find(p => p.name === 'Dawn');
		expect(dawn?.current).toBe(3);
	});

	test('tag without -> still parses normally', () => {
		const content = '[Clock:Suspicion 3/6]';
		const result = NotationParser.parse(content);
		const clock = result.progress.find(p => p.name === 'Suspicion');
		expect(clock?.current).toBe(3);
		expect(clock?.max).toBe(6);
	});
});
