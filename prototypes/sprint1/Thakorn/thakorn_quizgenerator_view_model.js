(function attachQuizViewModel(root, factory) {
  const api = factory();

  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  } else {
    root.QuizViewModel = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, () => {
  function buildQuestionViewModel(question, index, total, savedAnswer) {
    const progressPercent = total === 0 ? 0 : ((index + 1) / total) * 100;
    const hasSavedAnswer = savedAnswer !== null;

    return {
      label: `ข้อ ${index + 1} จาก ${total}`,
      progressPercent,
      questionText: question.question,
      choices: question.choices.map((choiceText, choiceIndex) => ({
        index: choiceIndex,
        label: `${String.fromCharCode(65 + choiceIndex)}. ${choiceText}`,
        classes: getChoiceClasses(choiceIndex, savedAnswer, question.correctIndex)
      })),
      feedback: {
        visible: hasSavedAnswer,
        text: hasSavedAnswer
          ? savedAnswer === question.correctIndex
            ? 'ถูกต้อง!'
            : 'ยังไม่ถูก ลองดูคำอธิบายด้านล่าง'
          : ''
      },
      explanation: question.explanation,
      previousDisabled: index === 0,
      nextLabel: index === total - 1 ? 'ดูผลคะแนน' : 'ถัดไป →'
    };
  }

  function getChoiceClasses(choiceIndex, savedAnswer, correctIndex) {
    const classes = [];

    if (choiceIndex === savedAnswer) {
      classes.push('selected');
    }
    if (choiceIndex === correctIndex) {
      classes.push('correct');
    }
    if (choiceIndex === savedAnswer && savedAnswer !== correctIndex) {
      classes.push('incorrect');
    }

    return classes;
  }

  return { buildQuestionViewModel };
});
