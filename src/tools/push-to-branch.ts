import { z } from "zod";
import { tool } from "@langchain/core/tools";
import simpleGit from "simple-git";
import { getProjectAbsolutePath } from "../workspace"; // ✅ Replace with actual file where you store project path

export const pushToBranchFunc = async ({
  branch,
  commitMessage,
}: {
  branch: string;
  commitMessage: string;
}) => {
  try {
    const repoPath = getProjectAbsolutePath(); // ✅ Use the path set by initializeWorkspace()

    console.log(`📌 Pushing changes from ${repoPath} to branch ${branch}`);

    const git = simpleGit(repoPath);

    // Fetch latest remote info
    await git.fetch();

    // Check if branch exists locally
    const branches = await git.branchLocal();
    if (!branches.all.includes(branch)) {
      console.log(`⚠️ Branch ${branch} not found locally. Creating it...`);
      await git.checkoutLocalBranch(branch);
    } else {
      await git.checkout(branch);
      await git.pull("origin", branch);
    }

    // Stage all changes
    await git.add(".");

    // Commit changes
    const commitResult = await git.commit(commitMessage);
    if (!commitResult.commit) {
      console.log("⚠️ No changes to commit");
      return { status: "no changes", branch };
    }

    // Push and set upstream if new
    await git.push(["-u", "origin", branch]);

    return { status: "✅ pushed", branch };
  } catch (error) {
    console.error("❌ Error pushing to branch:", error);
    throw error;
  }
};

const pushBranchSchema = z.object({
  branch: z.string().describe("The target branch to push to"),
  commitMessage: z.string().describe("Commit message for the push"),
});

const pushBranchToolProps = {
  name: "push_to_branch",
  description:
    "Pushes all local changes from the existing cloned repo folder to the specified branch of the remote repository.",
  schema: pushBranchSchema,
};

export const pushToBranchTool = tool(pushToBranchFunc, pushBranchToolProps);
