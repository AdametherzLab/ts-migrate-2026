import * as readline from 'readline';

/**
 * Prompts the user with a yes/no question.
 * @param question - The question to display
 * @param defaultValue - Default value if user presses enter
 * @param explanation - Optional explanation text shown before the question
 * @returns Promise resolving to boolean answer
 */
export async function askYesNo(
  question: string,
  defaultValue: boolean,
  explanation?: string
): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  if (explanation) {
    console.log('\n' + explanation);
  }

  const defaultStr = defaultValue ? 'Y/n' : 'y/N';
  return new Promise((resolve) => {
    rl.question(`\x1b[1m${question}\x1b[0m (${defaultStr})? `, (answer) => {
      rl.close();
      const input = answer.trim().toLowerCase();
      if (input === 'y' || input === 'yes') resolve(true);
      else if (input === 'n' || input === 'no') resolve(false);
      else resolve(defaultValue);
    });
  });
}

/**
 * Prompts the user to select from multiple choices.
 * @param question - The question to display
 * @param choices - Array of choice options with value, label, and optional description
 * @param defaultValue - Default value if user presses enter
 * @param explanation - Optional explanation text
 * @returns Promise resolving to selected value string
 */
export async function askMultipleChoice(
  question: string,
  choices: { value: string; label: string; description?: string }[],
  defaultValue: string,
  explanation?: string
): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  if (explanation) {
    console.log('\n' + explanation);
  }

  console.log(`\n\x1b[1m${question}\x1b[0m`);
  choices.forEach((choice, index) => {
    const marker = choice.value === defaultValue ? '\x1b[36m[default]\x1b[0m' : '';
    console.log(`  ${index + 1}. ${choice.label} ${marker}`);
    if (choice.description) {
      console.log(`     \x1b[90m${choice.description}\x1b[0m`);
    }
  });

  return new Promise((resolve) => {
    rl.question('\nEnter number or name: ', (answer) => {
      rl.close();
      const input = answer.trim().toLowerCase();
      
      // Try to parse as number
      const num = parseInt(input, 10);
      if (!isNaN(num) && num > 0 && num <= choices.length) {
        resolve(choices[num - 1].value);
        return;
      }
      
      // Try to match by value (case-insensitive)
      const match = choices.find(c => c.value.toLowerCase() === input);
      if (match) {
        resolve(match.value);
        return;
      }
      
      // Try to match by label (case-insensitive)
      const labelMatch = choices.find(c => c.label.toLowerCase().includes(input));
      if (labelMatch) {
        resolve(labelMatch.value);
        return;
      }
      
      // Fall back to default
      resolve(defaultValue);
    });
  });
}

/**
 * Prompts the user for text input.
 * @param question - The question/prompt to display
 * @param defaultValue - Default value if user presses enter
 * @param explanation - Optional explanation text
 * @returns Promise resolving to input string
 */
export async function askText(
  question: string,
  defaultValue: string,
  explanation?: string
): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  if (explanation) {
    console.log('\n' + explanation);
  }

  return new Promise((resolve) => {
    rl.question(`${question} [${defaultValue}]: `, (answer) => {
      rl.close();
      const input = answer.trim();
      resolve(input || defaultValue);
    });
  });
}
