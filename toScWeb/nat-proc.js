class NaturalTextProcessor {
  constructor() {
    this.identifiers = [
      'nrel_main_idtf',
      'question_of_natural_processing',
      'nrel_first_domain',
      'nrel_second_domain',
    ];

    this.identifiersToAppendToAnswer = [
      'nrel_translation',
      'nrel_basic_sequence',
      'nrel_alias'
    ];

    this.apiKey = '97a62899f3b5ec475d33b240e7aec2dfadade076';

    (async () => {
      this.keynodes = await this.getKeynodes([...this.identifiers, ...this.identifiersToAppendToAnswer]);

      window.sctpClient.event_create(
        SctpEventType.SC_EVENT_ADD_OUTPUT_ARC,
        this.keynodes['question_of_natural_processing'],
        (addr, arg) => {
          window.sctpClient.get_arc(arg).done(res => {
            const questionAddr = res[1];

            window.sctpClient.create_node(sc_type_const | sc_type_node)
              .done(answerAddr => {
                this.answerAddr = answerAddr;
                this.appendKeynodesToAnswer(this.identifiersToAppendToAnswer.map(identifier => this.keynodes[identifier])).then(
                  window.sctpClient.iterate_constr(
                    SctpConstrIter(SctpIteratorType.SCTP_ITERATOR_3F_A_A,
                      [
                        questionAddr,
                        sc_type_arc_pos_const_perm,
                        sc_type_link
                      ], {"agent_argument": 2})
                  ).done(results => {
                    const questionArgumentAddr = results.get(0, "agent_argument");

                    window.sctpClient.get_link_content(questionArgumentAddr)
                      .done(textForProcessing => {
                        this.generateTranslationConstruction(questionArgumentAddr).then(translationNodeAddr => {
                          this.doNaturalProcessing(textForProcessing, translationNodeAddr).finally(() => {
                            this.appendAnswerToQuestion(questionAddr);
                          });
                        });
                      });
                  })
                );
              });
          });
        });
    })();
  }

  getKeynodes(identifiers) {
    return new Promise(resolve => {
      SCWeb.core.Server.resolveScAddr(identifiers, keynodes => {
        resolve(keynodes);
      });
    });
  };

  appendKeynodesToAnswer(keynodes) {
    return Promise.all((keynodes || []).map(keynode => this.appendNodeToAnswer(keynode)));
  }

  appendAnswerToQuestion(questionAddr) {
    return new Promise(resolve => {
      window.sctpClient.create_arc(sc_type_arc_common | sc_type_const, questionAddr, this.answerAddr)
        .done(arcBetweenQuestionAndAnswer => {
          window.sctpClient.create_arc(sc_type_arc_pos_const_perm, window.scKeynodes.nrel_answer, arcBetweenQuestionAndAnswer)
            .done(arc => {
              resolve(arc);
            }).fail(() => {
            console.log('Failed to append answer to question')
          });
        });
    });
  };

  appendNodeToAnswer(nodeAddr) {
    return new Promise(resolve => {
      window.sctpClient.create_arc(sc_type_arc_pos_const_perm, this.answerAddr, nodeAddr)
        .done(() => resolve());
    });
  };

  generateNoRoleRelation(subjectAddr, relationAddr, objectAddr) {
    return new Promise(resolve => {
      window.sctpClient.create_arc(sc_type_arc_common | sc_type_const, subjectAddr, objectAddr)
        .done(arc => {
          this.appendNodeToAnswer(arc).then(() => {
            window.sctpClient.create_arc(sc_type_arc_pos_const_perm, relationAddr, arc)
              .done(arc2 => {
                this.appendNodeToAnswer(arc2).then(() => {
                  resolve();
                })
              });
          });
        });
    });
  };

  generateNode() {
    return new Promise(resolve => {
      window.sctpClient.create_node(sc_type_const | sc_type_node)
        .done(nodeAddr => {
          resolve(nodeAddr);
        });
    })
  }

  generateTextNode(text) {
    return new Promise(resolve => {
      window.sctpClient.create_link()
        .done(link => window.sctpClient.set_link_content(link, text)
          .done(() => resolve(link)));
    })
  }

  generateAbsoluteRelation(subjectAddr, objectAddr) {
    return new Promise(resolve => {
      window.sctpClient.create_arc(sc_type_arc_pos_const_perm, subjectAddr, objectAddr)
        .done(arc => {
          this.appendNodeToAnswer(arc).then(() => {
            resolve();
          });
        });
    });
  };

  async generateTranslationConstruction(questionArgumentAddr) {
    const translationNodeAddr = await this.generateNode();

    await this.appendNodeToAnswer(questionArgumentAddr);
    await this.appendNodeToAnswer(translationNodeAddr);
    await this.generateNoRoleRelation(questionArgumentAddr, this.keynodes['nrel_translation'], translationNodeAddr);

    return translationNodeAddr;
  }

  async getNlpResult(sentence, requestType) {
    const headers = new Headers({
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    });

    return fetch(`http://api.ispras.ru/texterra/v1/nlp?targetType=${requestType}&apikey=${this.apiKey}`, {
      method: 'POST',
      headers,
      body: JSON.stringify([{text: sentence}])
    }).then(response => {
      if (response.ok) {
        return response.json();
      }

      throw new Error('Network response was not ok.');
    });
  }

  async doNaturalProcessing(textForProcessing, translationNodeAddr) {
    console.log('textForProcessing: ', textForProcessing);
    console.log('translationNodeAddr: ', translationNodeAddr);

    const lemmaResponse = await this.getNlpResult(textForProcessing, "lemma");
    const {lemma} = lemmaResponse && lemmaResponse[0].annotations;

    const keyNodes = await Promise.all((lemma || []).map(async (lem, index) => {
      const {start, end, value} = lem;
      const key = textForProcessing.substring(start, end);

      const keyNode = await this.generateTextNode(key);
      await this.appendNodeToAnswer(keyNode);
      await this.generateAbsoluteRelation(translationNodeAddr, keyNode);
      const valueNode = await this.generateTextNode(value);
      await this.appendNodeToAnswer(valueNode);
      await this.generateNoRoleRelation(keyNode, this.keynodes['nrel_alias'], valueNode);

      return keyNode
    }));

    (keyNodes || []).map(async (keyNode, index) => {
      if (keyNodes[index + 1]) {
        await this.generateNoRoleRelation(keyNode, this.keynodes['nrel_basic_sequence'], keyNodes[index + 1]);
      }
    })
  }
}

(() => {
  SCWeb.core.Main.init = (() => {
    const original = SCWeb.core.Main.init.bind(SCWeb.core.Main);

    return param => original(param).done(() => {
      new NaturalTextProcessor();
    })
  })();
})();
