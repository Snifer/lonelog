import { DiceRoller, RollResult } from '../src/utils/dice-roller';

describe('DiceRoller', () => {
    test('rolls 1d6 correctly', () => {
        const result = DiceRoller.roll('1d6');
        expect(result).not.toBeNull();
        if (result) {
            expect(result.total).toBeGreaterThanOrEqual(1);
            expect(result.total).toBeLessThanOrEqual(6);
            expect(result.sides).toBe(6);
            expect(result.rolls).toHaveLength(1);
        }
    });

    test('rolls multiple dice with modifier', () => {
        const result = DiceRoller.roll('2d4 + 2');
        expect(result).not.toBeNull();
        if (result) {
            expect(result.total).toBeGreaterThanOrEqual(4); // min (1+1)+2
            expect(result.total).toBeLessThanOrEqual(10); // max (4+4)+2
            expect(result.modifier).toBe(2);
            expect(result.sides).toBe(4);
            expect(result.rolls).toHaveLength(2);
        }
    });

    test('extracts notation from d: line', () => {
        expect(DiceRoller.extractNotation('d: 1d20')).toBe('1d20');
        expect(DiceRoller.extractNotation('d: 2d6 + 4 -> 10')).toBe('2d6 + 4');
        expect(DiceRoller.extractNotation('   d: d100')).toBe('d100');
    });

    test('formats result in standard mode (NdS=total)', () => {
        const result9: RollResult = { notation: '2d6', total: 9, rolls: [5, 4], modifier: 0, sides: 6 };
        expect(DiceRoller.formatResult('d: 2d6', result9)).toBe('d: 2d6=9');
        // Replaces existing result
        expect(DiceRoller.formatResult('d: 2d6=5', result9)).toBe('d: 2d6=9');
    });

    test('formats result in detail mode (NdS=v1,v2,...  (High=x) (Low=y))', () => {
        const result: RollResult = { notation: '4d6', total: 17, rolls: [6, 5, 4, 2], modifier: 0, sides: 6 };
        const formatted = DiceRoller.formatResult('d: 4d6', result, {
            detailMode: true,
            highLabel: 'High',
            lowLabel: 'Low',
        });
        expect(formatted).toBe('d: 4d6=6,5,4,2  (High=6) (Low=2)');
    });

    test('detail mode hides annotation when label is empty', () => {
        const result: RollResult = { notation: '2d6', total: 7, rolls: [4, 3], modifier: 0, sides: 6 };
        const noHigh = DiceRoller.formatResult('d: 2d6', result, {
            detailMode: true,
            highLabel: '',
            lowLabel: 'Min',
        });
        expect(noHigh).toBe('d: 2d6=4,3  (Min=3)');

        const noLabels = DiceRoller.formatResult('d: 2d6', result, {
            detailMode: true,
            highLabel: '',
            lowLabel: '',
        });
        expect(noLabels).toBe('d: 2d6=4,3');
    });

    test('detail mode replaces existing result', () => {
        const result: RollResult = { notation: '2d6', total: 7, rolls: [4, 3], modifier: 0, sides: 6 };
        const formatted = DiceRoller.formatResult('d: 2d6=5,2  (High=5) (Low=2)', result, {
            detailMode: true,
            highLabel: 'High',
            lowLabel: 'Low',
        });
        expect(formatted).toBe('d: 2d6=4,3  (High=4) (Low=3)');
    });
});
