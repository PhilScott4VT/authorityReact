const User = require("../../User");
const { forEach } = require("async-foreach");
const { getLeaderInfo } = require("../Methods");
const Party = require("../Party");
const { userCosmeticInfo } = require("../../User");

class PartyVote {
  constructor(voteId) {
    this.voteId = voteId;
    this.voteInfo = undefined;
    /**
     * @type {Party}
     */
    this.partyInfo = undefined;
  }
  async fetchVoteInformation() {
    var db = require("../../../db");
    return new Promise((resolve, reject) => {
      db.query("SELECT * FROM partyVotes WHERE id = ?", [this.voteId], (err, results) => {
        if (err) {
          resolve({ error: "Error fetching vote." });
        } else {
          var vote = results[0];
          vote.actions = JSON.parse(vote.actions);
          resolve(vote);
        }
      });
    });
  }
  async actionToString() {
    var voteInfo;
    var tostr = "";
    var len = 0;
    if (!this.voteInfo) {
      voteInfo = await this.updateVoteInformation();
    } else {
      voteInfo = this.voteInfo;
    }
    await Promise.all(
      voteInfo.actions.map(async (action, idx) => {
        switch (action.action) {
          case "replaceChair":
            if (action.newOccupant) {
              var newOccupant = new User(action.newOccupant);
              await newOccupant.updateUserInfo();
              if (newOccupant.userInfo) {
                tostr += `<span class='redFont'>New ${getLeaderInfo(this.partyInfo, "title")}:</span> <u>${newOccupant.userInfo.politicianName}</u>`;
                if (len > 0) {
                  tostr += "<br/>";
                }
                len += 1;
              }
            }
            break;
          case "changePermissions":
            if (action.newPerms) {
              tostr += `<span class='redFont'>Change Permissions</span> of <u>${action.roleName}</u> to: `;
              var numRoles = Object.keys(action.newPerms).length;
              if (numRoles == 0) {
                tostr += "<span class='redFont'>None</span>";
              } else {
                Object.keys(action.newPerms).map((value, idx) => {
                  tostr += `<br/>${value}`;
                });
              }
              if (len > 0) {
                tostr += "<br/>";
              }
              len += 1;
            }
            break;
          case "renameRole":
            if (action.oldName != null && action.renameTo != null) {
              tostr += `<span class='redFont'>Rename Role:</span> <u>${action.oldName}</u> <b>to </b><u>${action.renameTo}</u>`;
              if (len > 0) {
                tostr += "<br/>";
              }
              len += 1;
            }
            break;
          case "deleteRole":
            if (action.roleName) {
              tostr += `<span class='redFont'>Delete Role:</span> <u>${action.roleName}</u>`;
              if (len > 0) {
                tostr += "<br/>";
              }
              len += 1;
            }
            break;
          case "changeOccupant":
            if (action.roleName != null && action.newOccupant != null) {
              var newOccupant = new User(action.newOccupant);
              await newOccupant.updateUserInfo();
              if (newOccupant.userInfo) {
                tostr += `<span class='redFont'>Change ${action.roleName} occupant</span> <b>to</b> <u>${newOccupant.userInfo.politicianName}</u>`;
                if (len > 0) {
                  tostr += "<br/>";
                }
                len += 1;
              }
            }
            break;
          case "changeFees":
            if (action.newFees != null && action.oldFees != null) {
              tostr += `<span class='redFont'>Change Fees</span> <b>from</b> <u>${action.oldFees}</u> <b>to</b> <u>${action.newFees}</u>`;
              if (len > 0) {
                tostr += "<br/>";
              }
              len += 1;
            }
            break;
          case "renameParty":
            if (action.oldName != null && action.proposedName != null) {
              tostr += `<span class='redFont'>Change Party Name</span> <b>from</b> <u>${action.oldName}</u> <b>to</b> <u>${action.proposedName}</u>`;
              if (len > 0) {
                tostr += "<br/>";
              }
              len += 1;
            }
            break;
          case "changeVotes":
            if (action.oldVotes != null && action.newVotes != null) {
              tostr += `<span class='redFont'>Change Party Votes</span> <b>from</b> <u>${action.oldVotes}</u> <b>to</b> <u>${action.newVotes}</u>`;
              if (len > 0) {
                tostr += "<br/>";
              }
              len += 1;
            }
            break;
        }
      })
    );
    return tostr;
  }
  async getVotes(arr) {
    var arr = eval(arr);
    var sum = 0;
    await Promise.all(
      arr.map(async (voter, idx) => {
        var votes = await this.getUserVotes(voter);
        sum += votes;
      })
    );
    return sum;
  }
  async getVoters(arr) {
    var arr = eval(arr);
    var newArr = [];
    await Promise.all(
      arr.map(async (voter, idx) => {
        var user = new User(voter);
        await user.updateUserInfo();

        var obj = { politicianName: user.userInfo.politicianName, id: user.userInfo.id, state: user.userInfo.state, votes: await this.getUserVotes(voter) };
        newArr.push(obj);
      })
    );
    return newArr;
  }
  async statusAsString() {
    var rtn = "IDK.";
    switch (this.voteInfo.passed) {
      case -1:
        rtn = "Ongoing";
        break;
      case 0:
        rtn = "<span class='redFont'>Vote Failed</span>";
        break;
      case 1:
        rtn = "<span class='greenFont'>Vote Passed</span>";
        break;
      case 2:
        rtn = "Ongoing <br/> <span class='redFont'><u><b>DELAYED</b></u></span>";
        break;
    }
    return rtn;
  }
  async getUserVotes(userId) {
    var user = new User(userId);
    await user.updateUserInfo();

    var share = (user.userInfo.partyInfluence / this.partyInfo.totalPartyInfluence).toFixed(3);
    var votes = Math.round(share * this.partyInfo.votes);

    return votes;
  }
  async updateVoteInformation() {
    var voteInformation = await this.fetchVoteInformation();
    if (!voteInformation.hasOwnProperty("error")) {
      this.voteInfo = voteInformation;

      var party = new Party(voteInformation.party);
      await party.updatePartyInfo();
      this.partyInfo = party.partyInfo;

      var pvActionString = await this.actionToString();
      var ayes = await this.getVotes(voteInformation.ayes);
      var nays = await this.getVotes(voteInformation.nays);
      var ayeVoterArray = await this.getVoters(voteInformation.ayes);
      var nayVoterArray = await this.getVoters(voteInformation.nays);

      this.voteInfo.actionString = pvActionString;
      this.voteInfo.author = await userCosmeticInfo(voteInformation.author);
      this.voteInfo.sumAyes = ayes;
      this.voteInfo.ayeVoters = ayeVoterArray;
      this.voteInfo.nayVoters = nayVoterArray;
      this.voteInfo.sumNays = nays;
      this.voteInfo.statusString = await this.statusAsString();
    } else {
      this.voteInfo = null;
    }
  }
  /**
   *
   * @param {String} variable Variable being updated.
   * @param {*} updateTo What variable is being updated to
   * @returns {number} 200 if query worked, 400 if not.
   */
  async updatePartyVoteVariable(variable, updateTo) {
    var database = require("../../../db");
    return new Promise((resolve, reject) => {
      database.query(`UPDATE partyVotes SET ${variable} = ? WHERE id = ?`, [updateTo, this.voteId], async function (err, result) {
        if (err) {
          reject(err);
        } else {
          resolve(200);
        }
      });
    });
  }

  /**
   * Ease of use method for updating party vote information within the DB. Does not work if column does not exist within the partyVotes table.
   * Must use corresponding data type, otherwise will return error.
   *  eg. updatePartyVote("nays",[1,2,3]) -> returns voteInfo object
   *  eg. updatePartyVote("nays","fuck you shithead") -> returns error.
   *  eg. updatePartyVote("thisColumnDoesntExist",99) -> returns error.
   * @param {String} variable Variable being updated.
   * @param {*} updateTo What variable is being updated to
   * @returns {Object} new vote information.
   */
  async updatePartyVote(variable, updateTo) {
    await this.updateVoteInformation();
    var currentPartyVoteInfo = this.voteInfo;
    if (currentPartyVoteInfo.hasOwnProperty(variable)) {
      var error;
      await this.updatePartyVoteVariable(variable, updateTo).catch((err) => {
        console.log(err);
        error = { error: "Update failed. Check variable type." };
      });
      if (!error) {
        await this.updateVoteInformation();
        return this.voteInfo;
      } else {
        return error;
      }
    } else {
      return { error: "Column does not exist in PV table." };
    }
  }
}
module.exports = PartyVote;
