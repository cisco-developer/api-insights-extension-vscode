import * as vscode from 'vscode';
import { TextDocument, Uri } from 'vscode';
import * as SpectralCore from '@stoplight/spectral-core';
// @ts-ignore
import rulesets from '@cisco-developer/api-insights-openapi-rulesets';
import { BASE_NAME } from '../../const';
import { Analyses, Linter } from '../../types';

enum SeverityTypes {
  Error,
  Warning,
  Information,
  Hint,
}

export class SpectralLinter implements Linter {
  spectral;

  collection: vscode.DiagnosticCollection;

  collectionName = 'spectralLinter';

  public analysesMap: { [key: string]: Analyses[] } = {};

  constructor(ruleset: any) {
    this.spectral = new SpectralCore.Spectral();
    this.spectral.setRuleset(ruleset);
    this.collection = vscode.languages.createDiagnosticCollection(
      this.collectionName,
    );
  }

  async lint(document: TextDocument) {
    if (!this.spectral) {
      return;
    }
    const { uri } = document;
    const spec = document.getText();
    const res = await this.spectral.run(spec);
    if (res) {
      this.analysesMap[uri.path] = res.map((_) => ({
        ruleKey: `${_.code}`,
        message: _.message,
        mitigation: '',
        analyzer: '',
        severity: SeverityTypes[_.severity].toLowerCase() as Analyses['severity'],
        data: [],
      }));
    }
    const collection = this.createCollection(res);
    if (collection) {
      this.collection.set(document.uri, collection);
    }
  }

  deleteDiagnostic(uri: Uri) {
    this.collection.delete(uri);
    delete this.analysesMap[uri.path];
  }

  private createCollection(info: Array<any>) {
    if (!info) {
      return null;
    }
    return info.map((item) => {
      const {
        range, message, severity, code,
      } = item;
      const _code = `${BASE_NAME} - ${code}`;
      return {
        code: _code,
        message,
        range: new vscode.Range(
          new vscode.Position(range.start.line, range.start.character),
          new vscode.Position(range.end.line, range.end.character),
        ),
        // @ts-ignore
        severity: vscode.DiagnosticSeverity[SeverityTypes[severity]],
        source: '',
      };
    });
  }
}

const spectralLinter = new SpectralLinter(rulesets);

export default spectralLinter;
