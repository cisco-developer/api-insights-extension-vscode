import * as vscode from 'vscode';
import {
  CodeActionProvider,
  Position,
  Range,
} from 'vscode';
import { Analyse, FILE_SCHEME, Analyses, Linter } from '../../types';
import { getFixs } from '../quickFix/index';
import { FileDiagnostics } from './file';
import { BASE_NAME } from '../../const';

export default class Solutions implements CodeActionProvider {
  public static readonly providedCodeActionsKind = [
    vscode.CodeActionKind.QuickFix,
  ];

  private fileDiagnostics: FileDiagnostics;

  private localLinter?: Linter;

  constructor(fileDiagnostics: FileDiagnostics, localLinter?:Linter) {
    this.fileDiagnostics = fileDiagnostics;
    this.localLinter = localLinter;
  }

  provideCodeActions(
    document: vscode.TextDocument,
    range: vscode.Range | vscode.Selection | Position[],
    context: vscode.CodeActionContext,
  ): vscode.ProviderResult<(vscode.CodeAction | vscode.Command)[]> {
    if (context.diagnostics && document.uri.scheme !== FILE_SCHEME.read) {
      const analysesMap = this.fileDiagnostics.analysesMap[document.uri.path];
      let analyses: Analyses[] = [];
      if (!analysesMap) {
        if (this.localLinter) {
          analyses = this.localLinter.analysesMap[document.uri.path];
        }
      } else {
        analyses = analysesMap[1];
      }

      let actions: (vscode.CodeAction | vscode.Command)[] = [];
      context.diagnostics.forEach((item) => {
        const analyse = analyses.filter((_) => {
          const code = (`${item.code}`)?.replace(`${BASE_NAME} - `, '');
          return code === _.ruleKey;
        })[0];
        if (!analyse) return;
        const { data, ...other } = analyse;
        actions = actions.concat(this.createCodeActions(item, other, document, range as any));
      });
      return actions;
    }
    return null;
  }

  createCodeActions(
    diagnostic: vscode.Diagnostic,
    analyse: Analyse,
    document: vscode.TextDocument,
    range: Range,
  ) {
    const solutions = getFixs(analyse.ruleKey);
    const actions: vscode.CodeAction[] = [];
    if (solutions) {
      solutions.forEach((item) => {
        const { start, end } = diagnostic.range;
        const res = item({ ...analyse, range: { start, end } }, document, range);
        if (!res) return null;
        const { title, edit } = res;
        const action = new vscode.CodeAction(
          title,
          vscode.CodeActionKind.QuickFix,
        );
        action.edit = edit;
        action.diagnostics = [diagnostic];
        action.isPreferred = true;
        actions.push(action);
        return actions;
      });
    }
    return actions;
  }
}
